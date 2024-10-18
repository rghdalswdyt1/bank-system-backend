import jwt from 'jsonwebtoken';
import Customer from '../../DB/model/customer.model.js';
import Token from '../../DB/model/token.model.js';
import Account from '../../DB/model/accountsBank.model.js';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';
import { sendOTPEmail } from '../../services/sendmail.js';
dotenv.config();
// إنشاء Token مع بيانات إضافية مثل email, phone, fullName
const generateToken = (customer) => {
  return jwt.sign(
    {
      id: customer._id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone
    },
    process.env.jwt_secret
  );
};

// دالة لتوليد رقم حساب عشوائي
const generateRandomAccountNumber = () => {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString(); // توليد رقم حساب مكون من 10 أرقام
  };
  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
  };
  
// إنشاء عميل جديد
export const createCustomer = async (req, res) => {
  try {
      const { name, email, phone, address, dateOfBirth, nationalID, password, repassword } = req.body;

      // Ensure all required fields are provided
      if (!name || !email || !phone || !address || !dateOfBirth || !nationalID || !password) {
          return res.status(400).json({ message: 'All fields are required' });
      }
       // Convert name, email, and address to lowercase
      const lowerCaseName = name.toLowerCase();
      const lowerCaseEmail = email.toLowerCase();
      const lowerCaseAddress = address.toLowerCase();

      // Check if customer already exists by email or national ID
      let existingCustomer = await Customer.findOne({ $or: [{ email }, { nationalID }] });
      if (existingCustomer) {
          return res.status(400).json({ message: 'Customer with this email or national ID already exists' });
      }
          // Generate OTP and expiry time (5 minutes)
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // OTP expires in 5 minutes

      // Hash the password
      const hashPassword = bcryptjs.hashSync(password, Number(process.env.saltround));

      // Create the new customer
      const customer = new Customer({ 
          name : lowerCaseName, 
          email : lowerCaseEmail, 
          phone, 
          address : lowerCaseAddress, 
          dateOfBirth, 
          nationalID, 
          password: hashPassword,
          repassword: hashPassword,
          otp,
      otpExpiry,
      isVerified: false // Set the customer as not verified yet
      });

      // Save the customer to the database
      await customer.save();
      // Send OTP to customer's email
    await sendOTPEmail(email, otp);
      // Generate a random account number

      res.status(201).json({
          message: 'Customer registered successfully, an OTP has been sent to your email. Please verify your email by submitting the OTP.',
          status: 201,
          success: true,
         
      });

      // Here you can add code to send a confirmation message to the customer via email or phone
  } catch (error) {
    if (error.code == 'EAUTH') {
      return res.status(400).json({ message: 'Error authenticating email provider. Please check your email configuration.' });
    } else {
      return res.status(400).json({ message: 'Error creating customer', error });
    }

  }
};
  // verifyOTP
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find the customer by email
    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check if OTP matches and is not expired
    if (customer.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (customer.otpExpiry < new Date()) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // OTP is correct and within the expiry time, mark customer as verified
    customer.isVerified = true;
    customer.otp = null; // Clear the OTP once verified
    customer.otpExpiry = null; // Clear the OTP expiry time

    await customer.save();

    // Generate a random account number
    const accountNumber = generateRandomAccountNumber();

    // Create a new bank account for the customer
    const account = new Account({
      customer: customer._id,
      accountType: 'Savings account',
      balance: 0,
      accountNumber,
      isDefault: true
    });

    await account.save();

    // Generate a token (after verification)
    const token = generateToken(customer);

    // Store the token in the database
    const customerToken = new Token({
      customer: customer._id,
      token
    });

    await customerToken.save();

    res.status(200).json({
      message: 'Customer verified successfully',
      token,
      accountNumber
    });

  } catch (error) {
    res.status(400).json({ message: 'Error verifying OTP', error });
  }
};




// تسجيل الدخول
export const loginCustomer = async (req, res) => {
  try {
    const { nationalID, password } = req.body;

    // البحث عن العميل باستخدام الرقم القومي
    const customer = await Customer.findOne({ nationalID });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // التحقق من كلمة المرور
    const match = bcryptjs.compareSync(password, customer.password);
    if (!match) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    // التحقق مما إذا كان العميل قد أكد OTP
    if (!customer.isVerified) {
      return res.status(400).json({ message: 'Please verify your email by submitting the OTP before logging in' });
    }

    // البحث عن التوكن الخاص بالعميل في قاعدة البيانات
    let customerToken = await Token.findOne({ customer: customer._id });

    if (!customerToken) {
      // إذا لم يكن التوكن موجودًا، نقوم بإنشاء توكن جديد
      const newToken = generateToken(customer);

      // تخزين التوكن الجديد في قاعدة البيانات
      customerToken = new Token({
        customer: customer._id,
        token: newToken
      });

      await customerToken.save();
    }

    // إعادة التوكن الموجود أو الجديد
    res.status(200).json({
      message: 'Login successful',
      token: customerToken.token
    });

  } catch (error) {
    console.log('Error logging in:', error);
    
    res.status(400).json({ message: 'Error logging in', error });
  }
};

  
  // Function لتحديث بيانات العميل
export const updateCustomer = async (req, res) => {
    const { id } = req.params;
    
    try {
      const updatedCustomer = await Customer.findByIdAndUpdate(id, req.body, { new: true });
      if (!updatedCustomer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      
      res.status(200).json({ message: 'Customer updated successfully', updatedCustomer });
    } catch (error) {
      res.status(400).json({ message: 'Error updating customer', error });
    }
  };
  
  // Function لتغيير كلمة المرور
  export const changePassword = async (req, res) => {
    const { nationalID, password, repassword } = req.body;
  
    // Check if password and repassword match
    if (password !== repassword) {
      return res.status(400).json({ message: 'New Password and rePassword do not match' });
    }
  
    try {
      console.log('Fetching customer with nationalID:', nationalID); // Debug log
      const customer = await Customer.findOne({ nationalID });
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found or error on nationalID' });
      }
  
      // Check if the new password is the same as the old password
      const isMatch = await bcryptjs.compareSync(password, customer.password);
      if (isMatch) {
        return res.status(400).json({ success: false, message: 'New password cannot be the same as the old password' });
      }
  
      // Hash the new password
      const hashedPassword = await bcryptjs.hashSync(password, Number(process.env.saltround));
  
      // Update the password
      customer.password = hashedPassword;
      await customer.save();
  
      res.status(200).json({ success: true, status: 200, message: 'Password changed successfully' });
    } catch (error) {
      console.error('Error changing password:', error); // Log the error
      res.status(400).json({ error: error.message }); // Return error message
    }
  };
  
  
  // Function لحذف العميل
  export const deleteCustomer = async (req, res) => {
    const { id } = req.params;
  
    try {
      // حذف جميع الحسابات البنكية الخاصة بالعميل
      await Account.deleteMany({ customer: id });
  
      // حذف الـ token الخاص بالعميل
      await Token.deleteMany({ customer: id });
  
      // حذف العميل
      const deletedCustomer = await Customer.findByIdAndDelete(id);
      if (!deletedCustomer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
  
      res.status(200).json({ message: 'Customer and associated data deleted successfully' });
    } catch (error) {
      res.status(400).json({ message: 'Error deleting customer', error });
    }
  };

  export const getCustomerById = async (req, res) => {
    try {
      const { id } = req.params;
  
      // البحث عن العميل باستخدام id
      const customer = await Customer.findById(id);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
  
      // إرسال بيانات العميل والحسابات المرتبطة به في الرد
      res.status(200).json({
        message: 'Customer and bank accounts found successfully',
        customer,
      });
    } catch (error) {
      res.status(400).json({ message: 'Error fetching customer', error });
    }
  };