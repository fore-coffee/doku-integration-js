const CheckStatusVirtualAccountData = require('../../_models/checkStatusVirtualAccountDataDTO');

test('paidAmount is a flat TotalAmount, not DOKU\'s object wrapped in value', () => {
  const data = new CheckStatusVirtualAccountData({
    paymentFlagReason: {},
    paidAmount: { value: '10000.00', currency: 'IDR' },
  });
  expect(data.paidAmount.toObject()).toEqual({ value: '10000.00', currency: 'IDR' });
});
