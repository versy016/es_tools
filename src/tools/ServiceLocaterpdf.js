import React, { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const ServiceLocater = ({goBack}) => {
    const adobeDCViewRef = useRef(null);
    const [downloadLink, setDownloadLink] = useState('');

    useEffect(() => {
        // Load the Adobe PDF Embed API script dynamically
        const script = document.createElement('script');
        script.src = 'https://acrobatservices.adobe.com/view-sdk/viewer.js';
        script.async = true;

        script.onload = () => {
            if (window.AdobeDC) {
                initializeAdobeDCView();
            } else {
                document.addEventListener("adobe_dc_view_sdk.ready", initializeAdobeDCView);
            }
        };

        script.onerror = (error) => {
            console.error('Error loading the Adobe PDF Embed API script:', error);
        };

        document.body.appendChild(script);

        function initializeAdobeDCView() {
            const adobeDCView = new window.AdobeDC.View({
                clientId: '8d2afd41524246b7a307dd165ac1b834',
                divId: 'adobe-dc-view',
            });

            adobeDCView.previewFile({
                content: {
                    location: {
                        url: 'https://estoolsbucketf6dca-dev.s3.amazonaws.com/public/Service%20Location%20Field%20Report_Form.pdf',
                    },
                },
                metaData: { fileName: 'Service Location Field Report_Form.pdf' },
            }, {
                embedMode: 'FULL_WINDOW',
                enableFormFilling: true
            });

            adobeDCViewRef.current = adobeDCView;
        }
    }, []);

    const handleFlattenAndDownload = async () => {
        try {
            const adobeDCView = adobeDCViewRef.current;
            if (!adobeDCView) {
                throw new Error('Adobe DC View is not initialized.');
            }

            const fileData = await fetch('https://estoolsbucketf6dca-dev.s3.amazonaws.com/public/Service%20Location%20Field%20Report_Form.pdf');
            const arrayBuffer = await fileData.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);

            const form = pdfDoc.getForm();
            form.flatten();

            const flattenedPdfBytes = await pdfDoc.save();
            const blob = new Blob([flattenedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setDownloadLink(url);
        } catch (error) {
            console.error('Error flattening the PDF:', error);
        }
    };

    return (
        <div>
            <div className="back-link" onClick={goBack}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back to Tools
            </div>
            <h1>Service Location Field Report</h1>
            <div id="adobe-dc-view" style={{ height: '600px' }}></div>
            <button onClick={handleFlattenAndDownload}>Download Flattened PDF</button>
            {downloadLink && (
                <a href={downloadLink} download="Service_Location_Field_Report_Flattened.pdf">
                    Click here to download your flattened PDF
                </a>
            )}
        </div>
    );
};

export default ServiceLocater;
