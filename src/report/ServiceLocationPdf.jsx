// @react-pdf/renderer document for the v1 Service Location Field Report.
// ServiceLocater.js renders <ServiceLocationDoc data={...}/> via pdf(...).toBlob() to
// produce a pixel-perfect PDF client-side — replacing the lossy .docx → Google Drive
// conversion. The Word file is still generated from the template for those who want it;
// this is the canonical PDF. Letterhead Header/Footer are fixed on every page; content
// (job details, utility checklist, DBYD, site notes, a 2-per-row photo grid, sign-off)
// flows and auto-paginates within a single Page.
import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

// Brand palette — kept local since @react-pdf can't read CSS variables.
const ES_YELLOW = '#F5A623';
const ES_DARK = '#1a1a1a';
const BORDER = '#cfcfcf';

const styles = StyleSheet.create({
    page: {
        paddingTop: 96,
        paddingBottom: 56,
        paddingHorizontal: 36,
        fontSize: 10,
        fontFamily: 'Helvetica',
        color: ES_DARK,
    },
    // Letterhead
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 8, backgroundColor: ES_YELLOW },
    header: {
        position: 'absolute', top: 20, left: 36, right: 36,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    logo: { width: 54, height: 54, objectFit: 'contain' },
    brand: { marginLeft: 8 },
    brandName: { fontSize: 15, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
    headerRight: { textAlign: 'right', fontSize: 8.5, color: '#444' },
    headerRightStrong: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: ES_DARK, marginBottom: 2 },
    footer: {
        position: 'absolute', bottom: 18, left: 36, right: 36,
        borderTopWidth: 1, borderTopColor: ES_YELLOW, paddingTop: 5,
    },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: '#777' },
    // Generic
    title: { fontSize: 16, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 12, textDecoration: 'underline' },
    sectionBar: { backgroundColor: ES_YELLOW, paddingVertical: 4, paddingHorizontal: 6, marginTop: 12 },
    sectionBarText: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
    // Two-column key/value tables
    twoCol: { flexDirection: 'row', gap: 10, marginTop: 6 },
    col: { flex: 1 },
    detailRow: { flexDirection: 'row', borderWidth: 1, borderColor: BORDER, borderTopWidth: 0 },
    detailRowFirst: { borderTopWidth: 1 },
    detailKey: { width: '42%', padding: 4, fontFamily: 'Helvetica-Bold', backgroundColor: '#faf6ec' },
    detailVal: { width: '58%', padding: 4 },
    // Checklist table
    table: { marginTop: 6, borderWidth: 1, borderColor: BORDER },
    tHead: { flexDirection: 'row', backgroundColor: ES_DARK },
    tHeadCell: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 9, padding: 5 },
    tRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: BORDER },
    tRowAlt: { backgroundColor: '#faf7f0' },
    tCell: { padding: 5, fontSize: 9 },
    cAsset: { width: '34%' },
    cQual: { width: '20%' },
    cComment: { width: '46%' },
    // DBYD note
    note: { borderWidth: 1, borderColor: BORDER, backgroundColor: '#fbfbfb', padding: 8, marginTop: 6, fontFamily: 'Helvetica-Bold' },
    // Site notes
    noteItem: { fontSize: 9.5, color: '#333', marginTop: 3, lineHeight: 1.3 },
    // Photo grid (2 per row)
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
    photoCard: { width: '50%', padding: 4 },
    photoImg: { width: '100%', height: 165, objectFit: 'cover', borderWidth: 1, borderColor: BORDER },
    photoName: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 3 },
    photoDesc: { fontSize: 8.5, color: '#444', marginTop: 1 },
    // Sign-off
    signoff: { marginTop: 14, borderTopWidth: 1, borderTopColor: ES_YELLOW, paddingTop: 8 },
    signoffTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#666', marginBottom: 4, textTransform: 'uppercase' },
    signoffImg: { height: 40, objectFit: 'contain', marginBottom: 2 },
    signoffRule: { borderTopWidth: 1, borderTopColor: ES_DARK, width: 200, marginBottom: 3 },
    signoffName: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
    signoffMeta: { fontSize: 8.5, color: '#444', marginTop: 1 },
});

const Header = () => (
    <View fixed>
        <View style={styles.topBar} />
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                <Image style={styles.logo} src="/images/logo.png" />
                <View style={styles.brand}>
                    <Text style={styles.brandName}>ENGINEERING</Text>
                    <Text style={styles.brandName}>SURVEYS</Text>
                </View>
            </View>
            <View style={styles.headerRight}>
                <Text style={styles.headerRightStrong}>engsurveys.com.au</Text>
                <Text>4/11 Ridley Street, Hindmarsh SA 5007</Text>
                <Text>+61 8 8340 4469  |  office@engsurveys.com.au</Text>
            </View>
        </View>
    </View>
);

const Footer = () => (
    <View style={styles.footer} fixed>
        <View style={styles.footerRow}>
            <Text>Engineering Surveys — Design and Dig with Confidence</Text>
            <Text>ABN 96 007 930 958   ACN 007 930 958</Text>
        </View>
    </View>
);

const Section = ({ title }) => (
    <View style={styles.sectionBar}><Text style={styles.sectionBarText}>{title}</Text></View>
);

// One bordered key/value row; `first` re-adds the top border. Empty values show '-'.
const DetailRow = ({ label, value, first }) => (
    <View style={[styles.detailRow, first ? styles.detailRowFirst : {}]}>
        <Text style={styles.detailKey}>{label}</Text>
        <Text style={styles.detailVal}>{value || '-'}</Text>
    </View>
);

const ServiceLocationDoc = ({ data = {} }) => {
    const checklist = data.checklist || [];
    const notes = Array.isArray(data.addnotes) ? data.addnotes : (data.addnotes ? [data.addnotes] : []);
    const photos = data.photos || [];
    const signoff = data.signoff;

    return (
        <Document title={`Service Location Field Report - ${data.jobLocation || ''}`} author="Engineering Surveys">
            <Page size="A4" style={styles.page}>
                <Header />
                <Text style={styles.title}>SERVICE LOCATION FIELD REPORT</Text>

                <Section title="JOB DETAILS" />
                <View style={styles.twoCol}>
                    <View style={styles.col}>
                        <DetailRow label="Date" value={data.date} first />
                        <DetailRow label="Client / Project" value={data.clientOrProject} />
                        <DetailRow label="Job Location" value={data.jobLocation} />
                    </View>
                    <View style={styles.col}>
                        <DetailRow label="Contact" value={data.contact} first />
                        <DetailRow label="Contact Mob." value={data.contactMob} />
                        <DetailRow label="Locater" value={data.surveyor} />
                        <DetailRow label="Locater Mob." value={data.locaterMob} />
                    </View>
                </View>

                <Section title="UTILITY SERVICES LOCATED" />
                <View style={styles.table}>
                    <View style={styles.tHead}>
                        <Text style={[styles.tHeadCell, styles.cAsset]}>Asset Type</Text>
                        <Text style={[styles.tHeadCell, styles.cQual]}>Quality</Text>
                        <Text style={[styles.tHeadCell, styles.cComment]}>Comment</Text>
                    </View>
                    {checklist.length === 0 ? (
                        <View style={styles.tRow}><Text style={[styles.tCell, { color: '#888' }]}>No services recorded.</Text></View>
                    ) : checklist.map((item, i) => (
                        <View key={i} style={[styles.tRow, i % 2 === 1 ? styles.tRowAlt : {}]} wrap={false}>
                            <Text style={[styles.tCell, styles.cAsset]}>{item.assetType}</Text>
                            <Text style={[styles.tCell, styles.cQual]}>{item.quality || '-'}</Text>
                            <Text style={[styles.tCell, styles.cComment]}>{item.comment || '-'}</Text>
                        </View>
                    ))}
                </View>

                <Section title="DBYD DETAILS" />
                {data.dbydByClient ? (
                    <Text style={styles.note}>DBYD to be supplied by client.</Text>
                ) : (
                    <View style={styles.twoCol}>
                        <View style={styles.col}>
                            <DetailRow label="DBYD Job Number" value={data.dbydjobno} first />
                            <DetailRow label="Date Requested" value={data.dbyddate} />
                            <DetailRow label="Plans Available" value={data.dbydavailable} />
                        </View>
                        <View style={styles.col}>
                            <DetailRow label="Plans Cover Areas" value={data.dbydplans} first />
                            <DetailRow label="SWMS Completed" value={data.SWMS} />
                            <DetailRow label="Plans Supplied by ES" value={data.plansupply} />
                        </View>
                    </View>
                )}

                {notes.length > 0 && (
                    <>
                        <Section title="SITE NOTES" />
                        <View style={{ marginTop: 4 }}>
                            {notes.map((n, i) => <Text key={i} style={styles.noteItem}>•  {n}</Text>)}
                        </View>
                    </>
                )}

                {photos.length > 0 && (
                    <>
                        <Section title="PHOTOS" />
                        <View style={styles.photoGrid}>
                            {photos.map((p, i) => (
                                <View key={i} style={styles.photoCard} wrap={false}>
                                    <Image style={styles.photoImg} src={p.src} />
                                    {p.name ? <Text style={styles.photoName}>{p.name}</Text> : null}
                                    {p.description ? <Text style={styles.photoDesc}>{p.description}</Text> : null}
                                </View>
                            ))}
                        </View>
                    </>
                )}

                {signoff && (signoff.signature || signoff.fullName) ? (
                    <View style={styles.signoff} wrap={false}>
                        <Text style={styles.signoffTitle}>Located &amp; reported by</Text>
                        {signoff.signature ? <Image style={styles.signoffImg} src={signoff.signature} /> : null}
                        <View style={styles.signoffRule} />
                        <Text style={styles.signoffName}>{signoff.fullName || data.surveyor || ''}</Text>
                        <Text style={styles.signoffMeta}>{[signoff.role, signoff.accreditation].filter(Boolean).join(' · ')}</Text>
                        <Text style={styles.signoffMeta}>{[signoff.mobile, signoff.email].filter(Boolean).join(' · ')}</Text>
                    </View>
                ) : null}

                <Footer />
            </Page>
        </Document>
    );
};

export default ServiceLocationDoc;
