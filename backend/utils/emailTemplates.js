function buildRegistrationEmail(fullName, email, password, patientId, barcodeValue, barcodeImage) {
    return `<!DOCTYPE html>...`; // exact same HTML as original
}

function buildOpdSlipEmail(appointment, patient, barcodeImage) {
    return `<div style="max-width:480px;...`; // exact same as original
}

function buildRegistrationEmailForExistingStaff(fullName, email, patientId, barcodeValue, barcodeImage) {
    return `<!DOCTYPE html>...`; // exact same as original
}

module.exports = {
    buildRegistrationEmail,
    buildOpdSlipEmail,
    buildRegistrationEmailForExistingStaff
};