import React from 'react';
import FileUpload from '../components/FileUpload';
import '../stylessheets/ServiceLocater.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
const ServiceLocater = ({goBack }) => {
  return (
      <div>
           <div className="back-link" onClick={goBack}>
        <FontAwesomeIcon icon={faArrowLeft} /> Back to Tools
      </div>
          <div className="service-locater">
             
      <h1>Service Location Field Report</h1>
      <form>
        <section className="job-details">
          <h2>Job Details</h2>
          <div className="job-details-grid">
            <label>
              Date:
              <input type="date" name="date" />
            </label>
            <label>
              Client:
              <input type="text" name="client" />
            </label>
            <label>
              Job Location:
              <input type="text" name="jobLocation" />
            </label>
            <label>
              Contact:
              <input type="text" name="contact" />
            </label>
            <label>
              Surveyor:
              <input type="text" name="surveyor" />
            </label>
            <label>
              Contact Mob. No:
              <input type="text" name="contactMob" />
            </label>
          </div>
        </section>

        <section className="checklist">
          <h2>Checklist (Standard)</h2>
          <table>
            <thead>
              <tr>
                <th>Asset Type</th>
                <th>Markings</th>
                <th>Quality</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {[
                { type: 'Gas', markings: 'G, GM, GS', quality: 'A,B,C,D' },
                { type: 'Sewer', markings: 'SWR', quality: 'A,B,C,D' },
                { type: 'Stormwater', markings: 'STW', quality: 'A,B,C,D' },
                { type: 'Telecommunications', markings: 'T, COMMS', quality: 'A,B,C,D' },
                { type: 'SAPN/Electrical', markings: 'HV, LV, E', quality: 'A,B,C,D' },
                { type: 'Traffic Signals', markings: 'TS', quality: 'A,B,C,D' },
                { type: 'Street Lighting', markings: 'SL', quality: 'A,B,C,D' },
                { type: 'Water', markings: 'WS, WM, W', quality: 'A,B,C,D' },
                { type: 'Fire Main', markings: 'FM', quality: 'A,B,C,D' },
                { type: 'Optic Fibre', markings: 'OF', quality: 'A,B,C,D' },
                { type: 'Reclaimed Water', markings: 'RW', quality: 'A,B,C,D' },
                { type: 'Unknown Services', markings: 'UK', quality: 'A,B,C,D' }
              ].map((item, index) => (
                <tr key={index}>
                  <td>
                    <label>
                      <input type="checkbox" name={item.type.toLowerCase()} />
                      {item.type}
                    </label>
                  </td>
                  <td>{item.markings}</td>
                  <td>
                    <label>
                      <input type="radio" name={`quality-${item.type.toLowerCase()}`} value="A" /> A
                      <input type="radio" name={`quality-${item.type.toLowerCase()}`} value="B" /> B
                      <input type="radio" name={`quality-${item.type.toLowerCase()}`} value="C" /> C
                      <input type="radio" name={`quality-${item.type.toLowerCase()}`} value="D" /> D
                    </label>
                  </td>
                  <td><input type="text" name={`comment-${item.type.toLowerCase()}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="site-notes">
          <h2>Site Notes</h2>
                      <textarea name="siteNotes" rows="10" style={{ width: '50rem' }}></textarea>
        </section>

        <section className="photos">
          <h2>Photos</h2>
          <input type="file" accept="image/*" multiple />
        </section>

        <div className="buttons">
          <button type="submit">Submit Report</button>
         </div>
      </form>
          </div>
        
        <h1>File Upload to S3</h1>
          <FileUpload />
      </div>
  );
};

export default ServiceLocater;
