const express = require('express');
const router = express.Router();
const { logger, accessLogger } = require("../logger");
const authSerivce = require('../service/authenticationService');
router.get('/vaerifyUser/:user/:macaddress', async (req, res, next) => {
  try {
    var user = req.params.user;
    var dhMac = req.params.macaddress;
    accessLogger.info(`User validation reqrecieved from ${user} for ${dhMac}`);
    var response = await authSerivce.validateUser(user, dhMac);
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
    var response = await authSerivce.verifyAndExpireOTP(otp, dhMac, mobileNo);
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
