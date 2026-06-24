// @react-pdf/renderer document for the v2 Photo Report.
// PhotoReport.js renders <PhotoReportDoc job={job}/> through pdf(...).toBlob() to
// produce the branded PDF entirely client-side. Structure: a letterhead Header/Footer
// fixed on every page, a cover page (project/client/utilities/QL/comments/sign-off),
// a legend page (utility colours + AS 5488.1 quality-level definitions), then one
// page per annotated photo with its pothole cards. All colours/labels come from
// legendColors.js so screen and PDF stay in sync.
import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
    UTILITIES, getUtility, QUALITY_LEVELS,
    QUALITY_LEVEL_DEFINITIONS, ABBREVIATIONS, PHOTO_DISCLAIMER,
} from './legendColors';

// Brand palette — kept local since @react-pdf can't read CSS variables.
const ES_YELLOW = '#F5A623';
const ES_DARK = '#1a1a1a';
const BORDER = '#cfcfcf';

// react-pdf uses a flexbox subset (no grid, limited CSS); styles are plain objects
// in points. Top padding is large to clear the fixed letterhead header.
const styles = StyleSheet.create({
    page: {
        paddingTop: 96,
        paddingBottom: 56,
        paddingHorizontal: 36,
        fontSize: 10,
        fontFamily: 'Helvetica',
        color: ES_DARK,
    },
    // Header
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
    // Footer
    footer: {
        position: 'absolute', bottom: 18, left: 36, right: 36,
        borderTopWidth: 1, borderTopColor: ES_YELLOW, paddingTop: 5,
    },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: '#777' },
    footerDisclaimer: { fontSize: 7.5, color: '#555', marginBottom: 3, textAlign: 'center' },
    // Generic
    title: { fontSize: 16, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 12, textDecoration: 'underline' },
    sectionBar: { backgroundColor: ES_YELLOW, paddingVertical: 4, paddingHorizontal: 6, marginTop: 10 },
    sectionBarText: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
    // Detail tables (two columns)
    twoCol: { flexDirection: 'row', gap: 10 },
    col: { flex: 1 },
    detailRow: { flexDirection: 'row', borderWidth: 1, borderColor: BORDER, borderTopWidth: 0 },
    detailRowFirst: { borderTopWidth: 1 },
    detailKey: { width: '40%', padding: 4, fontFamily: 'Helvetica-Bold', backgroundColor: '#faf6ec' },
    detailVal: { width: '60%', padding: 4 },
    // Utilities located
    utilWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
    utilChip: { flexDirection: 'row', alignItems: 'center', width: '33%', marginBottom: 4 },
    utilDash: { width: 18, height: 6, marginRight: 5, borderWidth: 0.5, borderColor: '#999' },
    qlWrap: { flexDirection: 'row', marginTop: 6 },
    qlBox: {
        width: 26, height: 22, borderWidth: 1, borderColor: '#999', marginRight: 6,
        alignItems: 'center', justifyContent: 'center',
    },
    qlBoxOn: { backgroundColor: ES_YELLOW, borderColor: ES_DARK },
    qlBoxText: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
    comments: { borderWidth: 1, borderColor: BORDER, padding: 6, marginTop: 6, minHeight: 50 },
    // Sign-off
    signoff: { marginTop: 12, borderTopWidth: 1, borderTopColor: ES_YELLOW, paddingTop: 8 },
    signoffTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#666', marginBottom: 4, textTransform: 'uppercase' },
    signoffImg: { height: 40, objectFit: 'contain', marginBottom: 2 },
    signoffRule: { borderTopWidth: 1, borderTopColor: ES_DARK, width: 200, marginBottom: 3 },
    signoffName: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
    signoffMeta: { fontSize: 8.5, color: '#444', marginTop: 1 },
    // Legend page
    legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    legendDash: { width: 46, height: 8, marginRight: 10, borderWidth: 0.5, borderColor: '#999' },
    legendLabel: { fontSize: 11 },
    qlDefTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginTop: 8 },
    qlDefText: { fontSize: 9.5, color: '#333', marginTop: 2, lineHeight: 1.35 },
    para: { fontSize: 9.5, color: '#333', lineHeight: 1.4, marginBottom: 6 },
    // Photo page
    photoHeading: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
    mainPhoto: { width: '100%', objectFit: 'contain', maxHeight: 430, borderWidth: 1, borderColor: BORDER },
    potholeTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 4 },
    potholeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    potholeCard: { width: 110, borderWidth: 1, borderColor: BORDER, padding: 3 },
    potholeImg: { width: '100%', height: 80, objectFit: 'cover' },
    potholeCap: { fontSize: 7.5, marginTop: 2 },
    potholeCapStrong: { fontFamily: 'Helvetica-Bold', fontSize: 8 },
    abbrevBox: { borderWidth: 1, borderColor: BORDER, padding: 6, marginTop: 10, backgroundColor: '#fbfbfb' },
    abbrevTitle: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginBottom: 3 },
    abbrevWrap: { flexDirection: 'row', flexWrap: 'wrap' },
    abbrevItem: { width: '50%', fontSize: 7.5, color: '#444', marginBottom: 1 },
});

// Letterhead repeated on every page: `fixed` pins it outside the page flow.
// Yellow top bar + logo/brand on the left, contact block on the right.
const Header = () => (
    <View fixed>
        <View style={styles.topBar} />
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                {/* Served from public/ — absolute path resolves at render time */}
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

// Fixed footer: ABN/ACN strap on every page; the pothole disclaimer is only
// shown on photo pages (passed `disclaimer` prop) since those carry the markings.
const Footer = ({ disclaimer }) => (
    <View style={styles.footer} fixed>
        {disclaimer ? <Text style={styles.footerDisclaimer}>{PHOTO_DISCLAIMER}</Text> : null}
        <View style={styles.footerRow}>
            <Text>Engineering Surveys — Design and Dig with Confidence</Text>
            <Text>ABN 96 007 930 958   ACN 007 930 958</Text>
        </View>
    </View>
);

// One bordered key/value row in the cover's two-column detail tables.
// `first` re-adds the top border (other rows share borders to avoid doubling).
// Empty values render as '-' so cells never collapse.
const DetailRow = ({ label, value, first }) => (
    <View style={[styles.detailRow, first ? styles.detailRowFirst : {}]}>
        <Text style={styles.detailKey}>{label}</Text>
        <Text style={styles.detailVal}>{value || '-'}</Text>
    </View>
);

// Page 1: project + client detail tables, the located-utilities chips, the
// quality-level boxes, free-text comments, and an optional sign-off block.
const CoverPage = ({ job }) => {
    // Keys of the utilities ticked on the form; drives the chips below.
    const utils = job.utilitiesLocated || [];
    return (
        <Page size="A4" style={styles.page}>
            <Header />
            <Text style={styles.title}>PHOTO REPORT</Text>

            <View style={styles.twoCol}>
                <View style={styles.col}>
                    <View style={styles.sectionBar}><Text style={styles.sectionBarText}>PROJECT DETAILS</Text></View>
                    <DetailRow label="Locator" value={job.locatorName} first />
                    <DetailRow label="Date" value={job.date} />
                    <DetailRow label="DBYD No" value={job.dbydNo} />
                    <DetailRow label="Site Address" value={job.siteAddress} />
                    <DetailRow label="Scope of Works" value={job.scopeOfWorks} />
                </View>
                <View style={styles.col}>
                    <View style={styles.sectionBar}><Text style={styles.sectionBarText}>CLIENT DETAILS</Text></View>
                    <DetailRow label="Client Name" value={job.clientName} first />
                    <DetailRow label="Client Contact" value={job.clientContact} />
                    <DetailRow label="Mobile No" value={job.clientMobile} />
                    <DetailRow label="DBYD Email" value={job.dbydEmail} />
                    <DetailRow label="Ref No" value={job.refNo} />
                </View>
            </View>

            <View style={styles.sectionBar}><Text style={styles.sectionBarText}>UTILITIES LOCATED</Text></View>
            <View style={styles.utilWrap}>
                {/* Only render chips for the selected utilities, in canonical legend order */}
                {(utils.length ? UTILITIES.filter((u) => utils.includes(u.key)) : []).map((u) => (
                    <View style={styles.utilChip} key={u.key}>
                        <View style={[styles.utilDash, { backgroundColor: u.color }]} />
                        <Text>{u.label}</Text>
                    </View>
                ))}
                {utils.length === 0 ? <Text style={{ color: '#888' }}>None selected</Text> : null}
            </View>

            <View style={styles.sectionBar}><Text style={styles.sectionBarText}>LOCATED TO QUALITY LEVEL (AS 5488.1:2022)</Text></View>
            <View style={styles.qlWrap}>
                {/* A–D boxes; selected ones are filled yellow (qlBoxOn) */}
                {QUALITY_LEVELS.map((q) => {
                    const on = job.qualityLevels && job.qualityLevels[q];
                    return (
                        <View key={q} style={[styles.qlBox, on ? styles.qlBoxOn : {}]}>
                            <Text style={styles.qlBoxText}>{q}</Text>
                        </View>
                    );
                })}
            </View>

            <View style={styles.sectionBar}><Text style={styles.sectionBarText}>COMMENTS</Text></View>
            <Text style={styles.comments}>{job.comments || ' '}</Text>

            {/* Sign-off comes from the user's saved profile (getSignoff). Rendered
                only if there's a signature image or name; wrap={false} keeps it intact. */}
            {job.signoff && (job.signoff.signature || job.signoff.fullName) ? (
                <View style={styles.signoff} wrap={false}>
                    <Text style={styles.signoffTitle}>Located &amp; reported by</Text>
                    {job.signoff.signature ? <Image style={styles.signoffImg} src={job.signoff.signature} /> : null}
                    <View style={styles.signoffRule} />
                    <Text style={styles.signoffName}>{job.signoff.fullName || job.locatorName || ''}</Text>
                    <Text style={styles.signoffMeta}>{[job.signoff.role, job.signoff.accreditation].filter(Boolean).join(' · ')}</Text>
                    <Text style={styles.signoffMeta}>{[job.signoff.mobile, job.signoff.email].filter(Boolean).join(' · ')}</Text>
                </View>
            ) : null}

            <Footer />
        </Page>
    );
};

// Page 2: static reference page — full utility colour legend plus the verbatim
// AS 5488.1:2022 quality-level definitions. Content is fixed (sourced from
// legendColors.js), independent of the job, so every report carries the same key.
const LegendPage = () => (
    <Page size="A4" style={styles.page}>
        <Header />
        <View style={styles.sectionBar}><Text style={styles.sectionBarText}>UTILITY LEGEND — DIT SPECIFICATION</Text></View>
        <View style={{ marginTop: 8, marginBottom: 8 }}>
            {UTILITIES.map((u) => (
                <View style={styles.legendRow} key={u.key}>
                    <View style={[styles.legendDash, { backgroundColor: u.color }]} />
                    <Text style={styles.legendLabel}>{u.label}</Text>
                </View>
            ))}
        </View>

        <View style={styles.sectionBar}><Text style={styles.sectionBarText}>QUALITY LEVELS EXPLAINED (AS 5488.1:2022)</Text></View>
        <Text style={[styles.para, { marginTop: 8 }]}>
            Labeling utility information by a Quality Level allows the user of this photo report to clearly
            understand how the information was collected and to what positional accuracy. For a complete
            definition refer to AS 5488.1:2022 "Australian Standard for Classification of Subsurface Utility
            Information — Part 1: Subsurface Utility Information".
        </Text>
        {QUALITY_LEVEL_DEFINITIONS.map((d) => (
            <View key={d.level} wrap={false}>
                <Text style={styles.qlDefTitle}>{d.level}</Text>
                <Text style={styles.qlDefText}>{d.text}</Text>
            </View>
        ))}
        <Text style={[styles.para, { marginTop: 8, fontFamily: 'Helvetica-Bold' }]}>
            Subsurface utilities shown as QL-C & QL-D should NOT be relied upon for any type of excavation or
            detailed design works.
        </Text>
        <Footer />
    </Page>
);

// One page per photo: the flattened (annotated) image, an optional grid of
// pothole cards, and the abbreviations legend box. `flattenedDataUrl` is the
// annotated render baked by the editor; falls back to the raw `src` if unedited.
const PhotoPage = ({ photo, index }) => {
    const num = String(index + 1).padStart(2, '0'); // "01", "02"… matches on-screen numbering
    const potholes = photo.potholes || [];
    return (
        <Page size="A4" style={styles.page}>
            <Header />
            <Text style={styles.photoHeading}>Photo {num}</Text>
            <Image style={styles.mainPhoto} src={photo.flattenedDataUrl || photo.src} />

            {potholes.length > 0 && (
                <>
                    <Text style={styles.potholeTitle}>Potholes</Text>
                    <View style={styles.potholeGrid}>
                        {potholes.map((p) => {
                            // Resolve the utility for its short code; caption reads "Label — CODE QL<level>"
                            const u = getUtility(p.utility);
                            return (
                                <View style={styles.potholeCard} key={p.id} wrap={false}>
                                    <Image style={styles.potholeImg} src={p.src} />
                                    <Text style={styles.potholeCapStrong}>{p.label} — {u.code} QL{p.qualityLevel}</Text>
                                    {p.depth ? <Text style={styles.potholeCap}>{p.depth}</Text> : null}
                                    {p.comment ? <Text style={styles.potholeCap}>{p.comment}</Text> : null}
                                </View>
                            );
                        })}
                    </View>
                </>
            )}

            <View style={styles.abbrevBox} wrap={false}>
                <Text style={styles.abbrevTitle}>LEGEND</Text>
                <View style={styles.abbrevWrap}>
                    {ABBREVIATIONS.map((a) => (
                        <Text style={styles.abbrevItem} key={a}>{a}</Text>
                    ))}
                </View>
            </View>

            <Footer disclaimer />
        </Page>
    );
};

// Top-level document builder consumed via pdf(<PhotoReportDoc job={job}/>).toBlob().
// Page order: cover, legend, then one PhotoPage per photo in array order.
const PhotoReportDoc = ({ job }) => (
    <Document title={`Photo Report - ${job.siteAddress || ''}`} author="Engineering Surveys">
        <CoverPage job={job} />
        <LegendPage />
        {(job.photos || []).map((photo, i) => (
            <PhotoPage key={photo.id} photo={photo} index={i} />
        ))}
    </Document>
);

export default PhotoReportDoc;
