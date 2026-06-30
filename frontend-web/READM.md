# Fiori App - SAP ECC Connection

## Overview
This is a SAP Fiori application designed to connect to SAP ECC (Enterprise Central Component) for enterprise data integration and management.

## Features
- Integration with SAP ECC backend
- Responsive UI built with SAP UI5
- Real-time data synchronization
- User-friendly interface

## Prerequisites
- SAP NetWeaver Gateway or SAP HANA
- SAP UI5 SDK
- Node.js (for development)
- npm or yarn
- CORS proxy configuration (if needed)

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd frontend-web
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configuration
Update `manifest.json` with your SAP ECC connection details:
- Backend service URL
- Authentication credentials
- OData service endpoints

### 4. Development Server
```bash
npm start
```

The application will be available at `http://localhost:8080`

## Building for Production
```bash
npm run build
```

## Connection to SAP ECC

### OData Services
This application connects to SAP ECC through OData services. Ensure the following:
- OData service is enabled in SAP ECC
- Gateway service is properly configured
- Authentication method (OAuth2, Basic Auth, etc.) is set up

### Environment Variables
Create a `.env` file with:
```
VUE_APP_API_URL=https://<sap-ecc-host>:<port>/sap/opu/odata/
VUE_APP_AUTH_TYPE=Basic
```

## Project Structure
```
frontend-web/
├── src/
│   ├── components/
│   ├── views/
│   ├── services/
│   └── App.vue
├── manifest.json
├── package.json
└── README.md
```

## Technologies Used
- SAP UI5 / Vue.js
- OData Protocol
- REST API
- JavaScript ES6+

## Support & Documentation
For more information on SAP Fiori development, refer to:
- [SAP Fiori Documentation](https://experience.sap.com/fiori)
- [SAP UI5 Tutorials](https://sapui5.hana.ondemand.com)

## License
This project is licensed under SAP Internal Use License.
