// Keep all the original JavaScript functionality intact
let appliedCoupon = null;

function applyCoupon() {
  const couponCode = document.getElementById("couponCode").value;
  const subtotal = parseFloat(document.getElementById("subtotal").textContent);

  fetch("/apply-coupon", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ couponCode, subtotal }),
  })
    .then((response) => response.json())
    .then((data) => {
      const messageElement = document.getElementById("couponMessage");
      if (data.success) {
        appliedCoupon = data.coupon;
        updateOrderSummary();
        messageElement.textContent = "Coupon applied successfully!";
        messageElement.style.color = "green";
        document.getElementById("appliedCoupon").style.display = "block";
        document.getElementById("appliedCouponName").textContent =
          data.coupon.name;
        document.getElementById("couponSectionDiv").style.display = "none";
      } else {
        messageElement.textContent = data.message;
        messageElement.style.color = "red";
      }
      messageElement.style.display = "block";
    })
    .catch((error) => {
      console.error("Error:", error);
      Swal.fire(
        "Error",
        "An error occurred while applying the coupon",
        "error"
      );
    });
}

function removeCoupon() {
  appliedCoupon = null;
  updateOrderSummary();
  document.getElementById("appliedCoupon").style.display = "none";
  document.getElementById("couponSectionDiv").style.display = "block";
  document.getElementById("couponMessage").style.display = "none";
  document.getElementById("couponCode").value = "";
}

function updateOrderSummary() {
  const subtotalElement = document.getElementById("subtotal");
  const couponDiscountElement = document.getElementById("couponDiscount");
  const grandTotalElement = document.getElementById("grandTotal");

  const subtotal = parseFloat(subtotalElement.textContent);
  let discount = 0;

  if (appliedCoupon) {
    discount = appliedCoupon.offerPrice;
  }

  const grandTotal = subtotal - discount + 50;

  couponDiscountElement.textContent = discount.toFixed(2);
  grandTotalElement.textContent = grandTotal.toFixed(2);
}

function checkStockAvailability() {
  return fetch("/checkStock")
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) {
        throw new Error(data.message);
      }
      return data.items;
    });
}

async function placeOrder() {
  try {
    const selectedAddress = document.getElementById("existingAddress");
    const paymentMethod = document.querySelector(
      'input[name="payment"]:checked'
    );

    if (!selectedAddress || selectedAddress.value === "Select an address") {
      Swal.fire("Error", "Please select a shipping address", "error");
      return;
    }

    if (!paymentMethod) {
      Swal.fire("Error", "Please select a payment method", "error");
      return;
    }

    // Check stock availability before proceeding
    const stockStatus = await checkStockAvailability();

    if (stockStatus.length === 0) {
      Swal.fire({
        title: "Cart Empty",
        text: "No items available in stock. Your cart will be cleared.",
        icon: "error",
        confirmButtonText: "Go to Shop",
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = "/shop";
        }
      });
      return;
    }

    // Check for blocked products
    const blockedProducts = stockStatus.filter((item) => item.isBlocked);
    if (blockedProducts.length > 0) {
      Swal.fire({
        title: "Products Blocked",
        text: "Some products in your cart have been blocked by admin. The page will reload to update your cart.",
        icon: "warning",
        confirmButtonText: "OK",
      }).then(() => {
        window.location.reload();
      });
      return;
    }

    if (stockStatus.some((item) => item.stockChanged)) {
      Swal.fire({
        title: "Stock Changed",
        text: "Some items in your cart have limited stock. The quantities have been adjusted.",
        icon: "warning",
        confirmButtonText: "Relod",
      }).then(() => {
        window.location.reload();
      });
      return;
    }

    proceedWithOrder();
  } catch (error) {
    console.error("Error:", error);
    Swal.fire(
      "Error",
      error.message || "An error occurred while placing the order",
      "error"
    );
  }
}

function proceedWithOrder() {
  const selectedAddress = document.getElementById("existingAddress");
  const paymentMethod = document.querySelector('input[name="payment"]:checked');

  const orderData = {
    addressId: selectedAddress.value,
    paymentMethod: paymentMethod.value,
    couponCode: appliedCoupon ? appliedCoupon.name : null,
  };

  switch (paymentMethod.value) {
    case "COD":
      processCODOrder(orderData);
      break;
    case "razorpay":
      processRazorpayOrder(orderData);
      break;
    case "wallet":
      placeWalletOrder(orderData);
      break;
  }
}

function processCODOrder(orderData) {
  fetch("/placeOrder", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderData),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Server response:", data);
      if (data.success) {
        // Redirect to order success page instead of showing modal
        window.location.href = "/ordersuccess";
      } else {
        Swal.fire(
          "Error",
          data.message || "An error occurred while placing the order",
          "error"
        );
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      Swal.fire("Error", "An error occurred while placing the order", "error");
    });
}

function verifyPayment(paymentResponse, orderData) {
  fetch("/verify-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paymentResponse,
      orderData,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Redirect to order success page instead of showing modal
        window.location.href = "/ordersuccess";
      } else {
        Swal.fire(
          "Error",
          data.message || "Payment verification failed",
          "error"
        );
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      Swal.fire(
        "Error",
        "An error occurred while verifying the payment",
        "error"
      );
    });
}

//palce wallet order
function placeWalletOrder(orderData) {
  const grandTotal = parseFloat(
    document.getElementById("grandTotal").textContent
  );
  const walletBalance = parseFloat(
    document.getElementById("walletBalance").textContent
  );

  document.getElementById("payableAmount").textContent = grandTotal.toFixed(2);

  if (walletBalance < grandTotal) {
    document.getElementById("insufficientFunds").style.display = "block";
    document.getElementById("confirmWalletPayment").style.display = "none";
  } else {
    document.getElementById("insufficientFunds").style.display = "none";
    document.getElementById("confirmWalletPayment").style.display = "block";
  }

  const modalElement = document.getElementById("walletPaymentModal");
  const walletModal = new bootstrap.Modal(modalElement);
  walletModal.show();

  //confirm payment
  document.getElementById("confirmWalletPayment").onclick = function () {
    fetch("/palceWalletOrder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...orderData, amount: grandTotal }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          window.location.href = "/ordersuccess";
        } else {
          Swal.fire(
            "Error",
            data.message || "An error occurred while processing you order",
            "error"
          );
        }
      })
      .catch((error) => {
        console.error("Error", error);
        Swal.fire(
          "Error",
          "An error occurred while processing the Order",
          "error"
        );
      });
  };
  walletModal.hide();
}

// Event listeners for document elements
document.addEventListener("DOMContentLoaded", function () {
  // Set up event listener for the place order button
  const placeOrderBtn = document.querySelector(".place-order-btn");
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener("click", placeOrder);
  }

  // Set up event listener for wallet payment confirmation
  const confirmWalletPaymentBtn = document.getElementById(
    "confirmWalletPayment"
  );
  if (confirmWalletPaymentBtn) {
    confirmWalletPaymentBtn.addEventListener("click", function () {
      const selectedAddress = document.getElementById("existingAddress");
      const orderData = {
        addressId: selectedAddress.value,
        paymentMethod: "wallet",
        couponCode: appliedCoupon ? appliedCoupon.name : null,
      };

      // Close the modal
      const walletPaymentModal = bootstrap.Modal.getInstance(
        document.getElementById("walletPaymentModal")
      );
      walletPaymentModal.hide();

      // Process the wallet order
      placeWalletOrder(orderData);
    });
  }

  // Initialize payment method selection behavior
  const paymentMethods = document.querySelectorAll(".payment-method");
  paymentMethods.forEach((method) => {
    method.addEventListener("click", function () {
      // Remove selected class from all methods
      paymentMethods.forEach((m) => m.classList.remove("selected"));
      // Add selected class to clicked method
      this.classList.add("selected");
      // Check the radio button
      const radio = this.querySelector('input[type="radio"]');
      radio.checked = true;
    });
  });
});

function addAddress() {
  const modalElement = document.getElementById("addressModal");
  let addressModal = new bootstrap.Modal(modalElement);

  document.getElementById("addressId").value = "";
  document.getElementById("fullName").value = "";
  document.getElementById("addressLine").value = "";
  document.getElementById("LandMark").value = "";
  document.getElementById("city").value = "";
  document.getElementById("state").value = "";
  document.getElementById("pincode").value = "";
  document.getElementById("country").value = "";
  document.getElementById("addressType").value = "";
  document.getElementById("altPhone").value = "";
  document.getElementById("isDefault").checked = "";
  document.getElementById("addressModalLabel").textContent = "Add New Address";
  addressModal.show();
}

function saveAddress() {
  const form = document.getElementById("addressForm");
  if (form.checkValidity()) {
    const formData = new FormData(form);
    const addressData = {
      _id: formData.get("addressId") || null,
      fullName: formData.get("fullName"),
      // phone: formData.get("phone"),
      addressLine: formData.get("addressLine"),
      landMark: formData.get("landMark"),
      altPhone: formData.get("altPhone"),
      city: formData.get("city"),
      state: formData.get("state"),
      pincode: formData.get("pincode"),
      country: formData.get("country"),
      type: formData.get("addressType"),
      isDefault: document.getElementById("isDefault").checked,
    };

    fetch("/save-address", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(addressData),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          Swal.fire({
            icon: "success",
            title: "Success!",
            text: data.message || "Address saved successfully",
            timer: 2000,
            showConfirmButton: false,
          }).then(() => {
            window.location.reload();
          });
        } else {
          Swal.fire({
            icon: "error",
            title: "Oops...",
            text: data.message || "There was an error saving your address",
          });
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "An unexpected error occurred. Please try again.",
        });
      });

    addressModal.hide();
  } else {
    form.reportValidity();
  }
}

// Update order summary on page load
updateOrderSummary();
