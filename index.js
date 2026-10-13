const Snap = require("./_modules/snap");
// DTO classes the caller instantiates; exported here so it needn't deep-import _models/.
const CreateVARequestDto = require("./_models/createVaRequestDto");
const TotalAmount = require("./_models/totalAmount");
const AdditionalInfo = require("./_models/additionalInfo");
const CheckStatusVARequestDto = require("./_models/checkStatusVARequestDTO");

const Doku = { 
    Snap,
    CreateVARequestDto,
    TotalAmount,
    AdditionalInfo,
    CheckStatusVARequestDto
}
module.exports = Doku;
