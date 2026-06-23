import React from 'react';
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';

// Photo annotation editor backed by react-filerobot-image-editor (Scaleflex).
// Opens over a photo, returns the flattened (annotated) image plus Filerobot's
// design state so the same photo can be re-opened and edited later.
const PhotoEditor = ({ photo, onSave, onClose }) => {
    const handleSave = (edited, designState) => {
        let dataUrl = edited.imageBase64;
        if (!dataUrl && edited.imageCanvas) {
            dataUrl = edited.imageCanvas.toDataURL('image/jpeg', 0.92);
        }
        if (dataUrl && !dataUrl.startsWith('data:')) {
            dataUrl = `data:image/jpeg;base64,${dataUrl}`;
        }
        onSave({ flattenedDataUrl: dataUrl || photo.src, designState });
    };

    return (
        <div className="fie-overlay">
            <div className="fie-modal">
                <FilerobotImageEditor
                    source={photo.src}
                    loadableDesignState={photo.designState || undefined}
                    onSave={handleSave}
                    onClose={onClose}
                    closeAfterSave
                    defaultSavedImageName={`photo_${Date.now()}`}
                    defaultSavedImageType="jpeg"
                    defaultSavedImageQuality={0.92}
                    savingPixelRatio={1}
                    tabsIds={[TABS.ANNOTATE, TABS.ADJUST, TABS.FINETUNE, TABS.FILTERS, TABS.RESIZE, TABS.WATERMARK]}
                    defaultTabId={TABS.ANNOTATE}
                    defaultToolId={TOOLS.ARROW}
                    annotationsCommon={{ stroke: '#2563EB', strokeWidth: 6, fill: 'rgba(0,0,0,0)' }}
                    Text={{ text: 'Label', fontSize: 28, fill: '#2563EB' }}
                />
            </div>
        </div>
    );
};

export default PhotoEditor;
