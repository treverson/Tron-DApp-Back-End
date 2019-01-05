var regex = {
    emailRegex: /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i,
    passRegex: /((?=.*\d)(?=.*[A-Z])(?=.*\W).{8,30})/,
};

module.exports = regex;