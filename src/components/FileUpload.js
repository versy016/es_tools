import React, { useState } from 'react';

const FileUpload = () => {
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});

  const handleChange = (event) => {
    setFiles(Array.from(event.target.files));
  };

  const getPresignedUrl = async (fileName, fileType) => {
    const response = await fetch('https://kc84cxp392.execute-api.ap-southeast-2.amazonaws.com/dev/presignedurl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName,
        contentType: fileType
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.uploadUrl;
    } else {
      throw new Error('Error generating presigned URL');
    }
  };

  const handleUpload = async () => {
    const uploadPromises = files.map(async (file) => {
      try {
        const uploadUrl = await getPresignedUrl(file.name, file.type);

        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', file.type);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(prevProgress => ({
              ...prevProgress,
              [file.name]: Math.round((event.loaded / event.total) * 100)
            }));
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            console.log(`File ${file.name} uploaded successfully`);
          } else {
            console.error(`File ${file.name} upload failed`, xhr.status, xhr.statusText);
          }
        };

        xhr.onerror = () => {
          console.error(`File ${file.name} upload failed`, xhr.status, xhr.statusText);
        };

        xhr.send(file);
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
      }
    });

    await Promise.all(uploadPromises);
  };

  return (
    <div>
      <input type="file" multiple onChange={handleChange} />
      <button onClick={handleUpload}>Upload</button>
      {Object.keys(uploadProgress).map((fileName) => (
        <p key={fileName}>Upload progress for {fileName}: {uploadProgress[fileName]}%</p>
      ))}
    </div>
  );
};

export default FileUpload;
