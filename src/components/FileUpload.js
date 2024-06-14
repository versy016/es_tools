import React, { useState } from 'react';
import { uploadData } from '@aws-amplify/storage';

const FileUpload = () => {
  const [file, setFile] = useState(null);

  const handleChange = (event) => {
    const file = event.target.files[0];
    setFile(file);
  };

  const handleUpload = async () => {
    try {
      if (file) {
        const result = await uploadData({
          path: `public/${file.name}`, // Specify the path where the file will be stored
          data: file,
          options: {
            contentType: file.type,
            onProgress: ({ transferredBytes, totalBytes }) => {
              if (totalBytes) {
                console.log(
                  `Upload progress ${
                    Math.round((transferredBytes / totalBytes) * 100)
                  } %`
                );
              }
            }
          }
        }).result;
        console.log('File uploaded successfully:', result);
      } else {
        console.log('No file selected');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleChange} />
      <button onClick={handleUpload}>Upload</button>
    </div>
  );
};

export default FileUpload;
