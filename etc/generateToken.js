const jwt = require('jsonwebtoken');

function createToken(params) {
    var token = jwt.sign(params, process.env.SECRET, {
        expiresIn: parseInt(process.env.JWT_TOKEN_EXPIRY_TIME)});
    return Promise.resolve(token);
}

function authorizeToken(token) {
    let verifiedTotken = jwt.verify(token, process.env.SECRET); 
    return verifiedTotken;
}
module.exports = { createToken };