const express = require('express');
const router = express.Router();
const { logger, accessLogger } = require("../logger");
const otpService = require('../service/OTPService');
router.get('/generateotp/:mobileno/:macaddress', async (req, res, next) => {
  try {
    var mobileNo = req.params.mobileno;
    var dhMac = req.params.macaddress;
    accessLogger.info(`OTP generation reqest recieved from ${mobileNo} for ${dhMac}`);
    var response = await otpService.generateOTP(mobileNo, dhMac);
    if (response.success) {
      res.send({
        data: response,
        success: true,
        msg: response.message
      });
    } else {
      res.status(400).send({
        data: {},
        success: false,
        msg: response.msg
      });
    }
  } catch (e) {
    logger.error('catch in updating status--->', e);
    res.status(500);
    res.send({
      data: e,
      success: false,
      msg: "Something went wrong"
    });
  }
});

router.get('/verifyotp/:macaddress/:otp/:mobileno', async (req, res, next) => {
  try {
    var otp = req.params.otp;
    var dhMac = req.params.macaddress;
    var mobileNo = req.params.mobileno;
    accessLogger.info(`Request to verify OTP for `, mobileNo, dhMac, otp);
    var response = await otpService.verifyAndExpireOTP(otp, dhMac, mobileNo);
    if (response.success) {
      res.send({
        id: response.id,
        success: true,
        msg: response.message
      });
    } else {
      res.status(400).send({
        data: {},
        success: false,
        msg: response.message
      });
    }
  } catch (e) {
    logger.error('catch in updating status--->', e);
    res.status(500);
    res.send({
      data: e,
      success: false,
      msg: "Something went wrong"
    });
  }
});


module.exports = router;
