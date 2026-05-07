const bwipjs = require('bwip-js');

function generateBarcodeDataURL(barcodeText) {
    return new Promise((resolve, reject) => {
        bwipjs.toBuffer({
            bcid: 'code128',
            text: barcodeText,
            scale: 3,
            height: 10,
            includetext: true,
            textxalign: 'center',
        }, (err, png) => {
            if (err) reject(err);
            else resolve(`data:image/png;base64,${png.toString('base64')}`);
        });
    });
}

module.exports = generateBarcodeDataURL;