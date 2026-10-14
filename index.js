const Snap = require("./_modules/snap");
// DTO classes the caller instantiates; exported here so it needn't deep-import _models/.
const CreateVARequestDto = require("./_models/createVaRequestDto");
const TotalAmount = require("./_models/totalAmount");
const AdditionalInfo = require("./_models/additionalInfo");
const CheckStatusVARequestDto = require("./_models/checkStatusVARequestDTO");

// an object literal (not a variable) so Node's CJS lexer sees the names for ESM named imports
module.exports = {
    Snap,
    CreateVARequestDto,
    TotalAmount,
    AdditionalInfo,
    CheckStatusVARequestDto
};
