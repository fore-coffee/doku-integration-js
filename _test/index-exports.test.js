const doku = require('../index');

test('root exports the DTO classes, identical to the _models deep paths', () => {
  expect(doku.CreateVARequestDto).toBe(require('../_models/createVaRequestDto'));
  expect(doku.TotalAmount).toBe(require('../_models/totalAmount'));
  expect(doku.AdditionalInfo).toBe(require('../_models/additionalInfo'));
  expect(doku.CheckStatusVARequestDto).toBe(require('../_models/checkStatusVARequestDTO'));
  expect(typeof doku.Snap).toBe('function');
});
