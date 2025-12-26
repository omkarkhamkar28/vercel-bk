const purchaseProductModel = require('../models/purchaseProductModel');
const Notification = require('../models/notificationModel');
const productsModel = require('../models/productsModel');

const mongoose = require("mongoose");


//add product purchase
const purchaseProductsController = async (req, res) => {
    try {
        const { user_id, product_id, user, name_en, name_mr, type_en, type_mr, quantity, totalPrice, states, paymentStates } = req.body;

        const product = await productsModel.findById(product_id);
        if (!product) return res.status(404).send({ success: false, message: "Product not found" });

        if (Number(quantity) > Number(product.stock)) return res.status(400).send({ success: false, message: "Not enough stock" });

        // Stock update
        product.stock = Number(product.stock) - Number(quantity);
        await product.save();

        // Purchase save
        const productsPurchase = await purchaseProductModel.create({ user_id, product_id, user, name_en, name_mr, type_en, type_mr, quantity, totalPrice, states, paymentStates });

        // Create notifications based on product schedule
        const purchaseDate = new Date();
        const notifications = product.schedule.map(sch => ({
            day: sch.day,
            message: sch.message,
            notifyDate: new Date(purchaseDate.getTime() + sch.day * 24 * 60 * 60 * 1000)
        }));

        await Notification.create({
            user: user_id,
            product: product_id,
            schedule: notifications
        });

        res.status(201).send({
            success: true,
            message: "Product purchased & notifications created",
            productsPurchase,
            remainingStock: product.stock
        });

    } catch (err) {
        console.log(err);
        res.status(500).send({ success: false, message: 'Error in purchasing', err });
    }
};

//single user all orders  
const getSingleuserOrdersDetails = async (req, res) => {
    try {
        const { userId } = req.params; // URL मधून userId घेतला

        // user_id नुसार orders fetch करा
        const orders = await productsModel.find({ user_id: userId })
            .sort({ purchaseDate: -1 }); // latest first

        if (!orders || orders.length === 0) {
            return res.status(200).send({
                success: true,
                message: "No orders found for this user",
                orders: []
            });
        }

        res.status(200).send({
            success: true,
            message: "User orders fetched successfully",
            orders
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({
            success: false,
            message: "Error fetching user orders",
            err
        });
    }
};

//all Orders Details
const getAllOrdersDetails = async (req, res) => {
    try {
        const orders = await purchaseProductModel.find({});
        res.status(200).send({
            success: true,
            message: "All Order Details ",
            orders
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: "Error While Geting all order detail",
            error,
        });
    }
};

//all Orders Details
const getSingleOrdersDetails = async (req, res) => {
    try {
        const order = await purchaseProductModel.findById(req.params.id);
        res.status(200).send({
            success: true,
            message: "Single Order Details ",
            order
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: "Error While Geting all order detail",
            error,
        });
    }
};

// Delete product purchase & notifications
const deleteProductPurchaseController = async (req, res) => {
    try {
        const { id } = req.params;

        // 1️⃣ Find the purchase
        const purchase = await purchaseProductModel.findById(id);
        if (!purchase) {
            return res.status(404).json({ success: false, message: "Product purchase not found" });
        }

        // 2️⃣ Fetch the product
        const product = await productsModel.findById(purchase.product_id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Associated product not found" });
        }

        // 3️⃣ Restore the stock
        product.stock = Number(product.stock) + Number(purchase.quantity);
        await product.save();

        // 4️⃣ Delete the purchase record
        await purchaseProductModel.findByIdAndDelete(id);

        // 5️⃣ Delete related notifications
        await Notification.deleteMany({ user: purchase.user_id, product: purchase.product_id });

        res.status(200).json({
            success: true,
            message: "Product purchase cancelled, stock restored & notifications deleted",
            restoredStock: product.stock
        });
    } catch (err) {
        console.error("Error deleting product purchase:", err);
        res.status(500).json({ success: false, message: "Error cancelling product purchase", error: err.message });
    }
};
 
const updateProductPurchaseController = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, states, paymentStates } = req.body;

    // 1️⃣ Order
    const order = await purchaseProductModel.findById(id);
    if (!order)
      return res.status(404).send({ success: false, message: "Order not found" });

    // 2️⃣ Product (IMPORTANT FIX HERE)
    const product = await productsModel.findById(order.product_id);
    if (!product)
      return res.status(404).send({ success: false, message: "Product not found" });

    // 3️⃣ Quantity logic
    const newQty = Number(quantity);
    const prevQty = Number(order.quantity);
    const stockAvailable = Number(product.stock);

    const stockChange = newQty - prevQty;

    if (stockAvailable - stockChange < 0) {
      return res.status(400).send({
        success: false,
        message: `Not enough stock. Available: ${stockAvailable}`,
      });
    }

    // 4️⃣ Update stock (🔥 SKIP VALIDATION)
    product.stock = stockAvailable - stockChange;
    await product.save({ validateBeforeSave: false });

    // 5️⃣ Update order
    order.quantity = newQty;
    order.totalPrice = newQty * Number(product.rate);
    order.states = states || order.states;
    order.paymentStates = paymentStates || order.paymentStates;
 
    await order.save();

    // 6️⃣ Response
    res.status(200).send({
      success: true,
      message: "Order updated successfully!",
      order,
      remainingStock: product.stock,
    });

  } catch (err) {
    console.error(err);
    res.status(500).send({
      success: false,
      message: "Error updating order",
      error: err.message,
    });
  }
};


 
module.exports = {
    purchaseProductsController,
    getAllOrdersDetails,
    deleteProductPurchaseController,
    getSingleuserOrdersDetails,
    updateProductPurchaseController,
    getSingleOrdersDetails
};