const Brand = require("../../models/Brand.js");
const Product = require("../../models/Products.js");

const getBrandPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const brandData = await Brand.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const totalBrands = await Brand.countDocuments();
    const totalPages = Math.ceil(totalBrands / limit);
    const reverseBrand = brandData.reverse();
    res.render("brand.ejs", {
      data: reverseBrand,
      currentPage: page,
      totalPages: totalPages,
      totalBrands: totalBrands,
    });
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const addBrand=async(req,res)=>{
    try {
        const brand=req.body.name;
        const findBrand=await Brand.findOne({brandName:brand});
        if(!findBrand){
            if (!req.file) {
                return res.status(400).json({ error: "Brand image is required." });
            }
            const image=req.file.filename;
              
            const newBrand=new Brand({
                brandName:brand,
                brandImage:image,
            })
            await newBrand.save();
            res.redirect("/admin/brands");
        }
        
    } catch (error) {
        res.redirect('/pageerror');
        console.log("Adding brand Error",error)
        
    }
}
// const addBrand = async (req, res) => {
//     try {
//       const brand = req.body.name;
//       const findBrand = await Brand.findOne({ brandName: brand });
  
//       if (!findBrand) {
//         const image = req.file.filename; // Use cropped image filename
//         const newBrand = new Brand({
//           brandName: brand,
//           brandImage: image,
//         });
  
//         await newBrand.save();
//         res.redirect("/admin/brands");
//       } else {
//         res.redirect("/admin/brands?error=Brand already exists");
//       }
//     } catch (error) {
//       console.error("Adding brand Error:", error);
//       res.redirect("/pageerror");
//     }
//   };

//block brand
const blockBrand=async(req,res)=>{
  try {
    const id=req.query.id;
    await Brand.updateOne({_id:id},{$set:{isBlocked:true}});
    res.redirect("/admin/brands");
  } catch (error) {
    res.redirect('/pageerror');
  }
}
const unBlockBrand=async(req,res)=>{
  try {
    const id=req.query.id;
    await Brand.updateOne({_id:id},{$set:{isBlocked:false}});
    res.redirect("/admin/brands");
  } catch (error) {
    res.redirect('/pageerror');
  }
}
const deleteBrand=async(req,res)=>{
  try {
    const {id}=req.query;
    if(!id){
      return re.status(400).redirect("/pageerror");
    }
    await Brand.deleteOne({_id:id});
    res.redirect('/admin/brands');
  } catch (error) {
    console.log("Error Deleting Brand",error);
    res.redirect("/pageerror");
  }
}

  
module.exports = { getBrandPage,addBrand,blockBrand,unBlockBrand,deleteBrand };
