import React from 'react';

const PdfConverter = ({ docLink, setPdfLink, setLoading }) => {

    const handleConvertToPdf = async () => {
        if (!docLink) {
            alert('Please generate the document first.');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('https://gwgsz3vjc3.execute-api.ap-southeast-2.amazonaws.com/dev/PDFConvertor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ docKey: docLink }), // Pass the S3 key of the DOCX file
            });

            if (response.ok) {
                const result = await response.json();
                setPdfLink(result.pdfUrl);
                console.info('PDF generated successfully');
            } else {
                console.error('Error generating the PDF');
            }
        } catch (error) {
            console.error('Error:', error);
        }

        setLoading(false);
    };

    return (
        <div>
            <button onClick={handleConvertToPdf}>Convert to PDF</button>
        </div>
    );
};

export default PdfConverter;
