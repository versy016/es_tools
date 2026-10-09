// SWMS tool — static data: the 19 High Risk Construction Work items, the four process
// libraries (Standard / DIT / Concrete Scanning / Underground Services), and per-template
// equipment / PPE / default-HRCW config. Ported verbatim from the standalone SWMS tool.
// Pure data + lookup helpers; no React, no DOM.

export const HIGH_RISK_ITEMS = [
    'Involves a risk of a person falling more than 3 metres',
    'Work is carried out on a telecommunication tower',
    'Work involves demolition of an element of a structure that is load bearing or otherwise related to the physical integrity of the structure',
    'Work involves or is likely to involve the disturbance of asbestos',
    'Work involves structural alterations or repairs that require temporary support to prevent collapse',
    'Work is carried out in or near a confined space',
    'Work is carried out in or near a shaft or trench with an excavated depth greater than 1.5 metres',
    'Work is carried out in or near a tunnel',
    'Work involves the use of explosives',
    'Work is carried out on or near pressurised gas distribution mains or piping',
    'Work is carried out on or near chemical, fuel or refrigerant lines',
    'Work is carried out on or near energised electrical installation or services',
    'Work is carried out in an area that may have contaminated or a flammable atmosphere',
    'Work involves tilt up or precast concrete',
    'Work is carried out on, in or adjacent to a road, railway, shipping lane or other traffic corridor that is in use by traffic other than pedestrians',
    'Work is carried out in an area at a workplace in which there is any movement of powered mobile plant',
    'Work is carried out in an area in which there are artificial extremes of temperature',
    'Work is carried out in or near water or other liquid that involves a risk of drowning',
    'Work involves diving',
];

// ---- STANDARD ----
const STANDARD_DB = [
    { process: 'CONTINUOUS — All Steps', actionBy: 'Everyone', hazards: [
        { hazard: 'COVID-19 pandemic / infectious disease risk', initialRisk: 'H-12', controls: 'Use social distancing: 1.5m spacing.\nAll staff travel in separate vehicles.\nAll accommodation to be separate rooms, no shared facilities.\nAvoid unnecessary meetings.\nFrequently wash hands for ≥20 seconds with soap and water or alcohol-based gel.\nRefrain from touching mouth and nose.\nIf coughing/sneezing, cover with tissue or flexed elbow and perform hand hygiene.\nShared survey equipment to be wiped with disinfectant before & after use.', residualRisk: 'L-2' },
    ] },
    { process: 'Access site', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Personnel unaware of site conditions, rules and specific hazards', initialRisk: 'H-16', controls: 'Industry induction training (white card).\nAttend site specific inductions.\nRead, understand and sign on to SWMS.\nWearing appropriate PPE: hard hat, safety glasses, long sleeves, long pants, safety boots.', residualRisk: 'L-2' },
        { hazard: 'Environmental conditions — extreme heat days, potential for heat stroke, sunburn', initialRisk: 'H-12', controls: 'Drinking plenty of water; wearing sun-hat/hard-hat, sunscreen. Monitoring dehydration signs i.e. urine colour.\nAbove 35°C take regular breaks in the shade.', residualRisk: 'M-4' },
        { hazard: 'Thunderstorms occurring — potential lightning strikes', initialRisk: 'M-10', controls: 'Cease work immediately; seek refuge inside buildings.', residualRisk: 'M-5' },
        { hazard: 'Wet weather conditions — wet and slippery environment, potential to lose footing and fall/slip', initialRisk: 'M-3', controls: 'Walk steadily and slowly; footwear in good condition. Do not tread on rail track — step over it.', residualRisk: 'M-3' },
    ] },
    { process: 'Mobilise equipment for survey set out; Carry survey equipment to setup location', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Struck by mobile plant/vehicles', initialRisk: 'H-16', controls: 'Positive contact to be made with operators/drivers before moving into the area of operating plant.\nAt no time are personnel to be within the operating arc of plant.\nPhysical separation to be maintained between operating plant and personnel.\nHi-vis clothing at all times.', residualRisk: 'L-2' },
        { hazard: 'Musculoskeletal strain from carrying equipment', initialRisk: 'M-6', controls: 'Use fitted back-strap attachment to carry total station as a backpack. Correct manual handling technique.', residualRisk: 'L-2' },
    ] },
    { process: 'Set up total station / GPS unit', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Slip/trip hazard during setup', initialRisk: 'H-16', controls: 'Ensure clear access. Set up clear of vehicle access ways where possible.', residualRisk: 'L-2' },
        { hazard: 'Personnel struck by operating plant', initialRisk: 'H-12', controls: 'Where there is a need to set up in the vicinity of operating plant, all plant within 15 metres is to cease operation if physical barriers are not used for separation.', residualRisk: 'L-2' },
    ] },
    { process: 'Set out', actionBy: 'All ES staff attending site', hazards: [
        { hazard: "Working in other trades' exclusion zones", initialRisk: 'H-12', controls: 'Communicate with relevant trades to gain authorisation for access.', residualRisk: 'L-2' },
        { hazard: 'Personnel struck by plant', initialRisk: 'H-12', controls: 'Where there is a need to set up in the vicinity of operating plant, all plant within 15 metres is to cease operation if physical barriers are not used for separation.', residualRisk: 'L-2' },
        { hazard: 'Surveyor using pogo may be unaware of surroundings due to focusing on data logger', initialRisk: 'H-12', controls: 'Survey assistant to act as spotter and advise surveyor of any hazards.', residualRisk: 'L-2' },
        { hazard: 'Working near edge or in EWP with equipment', initialRisk: 'M-9', controls: 'Check if anyone working below and secure equipment to person with tether.', residualRisk: 'L-2' },
    ] },
    { process: 'Pick up / surveying near excavations', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Fall from height / into excavation', initialRisk: 'H-12', controls: 'Compliant access to be used to access the base of excavations.\nWhen working around excavations of 2 metres or greater depth, personnel must remain behind barriers set at least 2 metres back from the edge, or there shall be compliant fixed edge protection in place.', residualRisk: 'L-2' },
        { hazard: 'Excavation collapse', initialRisk: 'H-12', controls: 'Excavations/trenches deeper than 1.5 metres are to be benched, battered or shored, or signed off by a geotechnical engineer prior to access.', residualRisk: 'L-2' },
    ] },
    { process: 'Levelling', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Electrocution: steel levelling staff coming in contact with power lines', initialRisk: 'H-12', controls: 'Surveyor & assistant to be aware of location of power lines at all times.\nStaff kept at minimum possible height at all times.', residualRisk: 'L-2' },
    ] },
    { process: 'Mark up with paint', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Flammable material; poison due to inhalation of paint fumes', initialRisk: 'M-8', controls: 'Refer to MSDS for storage & exposure levels. Ensure adequate ventilation.', residualRisk: 'L-2' },
    ] },
    { process: 'Putting pins in concrete', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Eye injury from flying debris when hammering masonry nails', initialRisk: 'M-8', controls: 'Safety glasses to AS1337 to be worn when hammering in masonry nails.', residualRisk: 'L-2' },
    ] },
    { process: 'Working in noisy environment', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Hearing damage; lack of situational awareness', initialRisk: 'M-10', controls: 'Earplugs to be used if personnel cannot move from the noisy area.', residualRisk: 'L-2' },
    ] },
    { process: 'Working at heights in Scissor lift or boom lift (EWP)', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Falling from EWP', initialRisk: 'M-8', controls: 'Wear a harness; only use trained and skilled operators with an EWP ticket.\nOperator to complete daily pre-start inspection.', residualRisk: 'L-2' },
        { hazard: 'Suspended in harness following a fall', initialRisk: 'M-8', controls: 'Designated person trained in EWP ground controls to be on the ground to lower the boom in an emergency. Spotter to observe worker.', residualRisk: 'L-2' },
        { hazard: 'Injury or mechanical failure in EWP at height', initialRisk: 'M-9', controls: 'EWP to be maintained as per manufacturers specifications.', residualRisk: 'L-2' },
        { hazard: 'Vertigo', initialRisk: 'M-8', controls: 'Take a rest every 2–3 minutes when working above head height.', residualRisk: 'L-2' },
        { hazard: 'EWP not level — risk of tip-over', initialRisk: 'H-12', controls: 'Make sure EWP is level on flat ground before starting any work.', residualRisk: 'L-2' },
    ] },
    { process: 'All site work — UV & skin contamination', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Damage to skin from UV and site contaminants', initialRisk: 'M-8', controls: 'Wear long sleeves and trousers as part of standard PPE.', residualRisk: 'L-2' },
    ] },
    { process: 'General — Compliance monitoring', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Failure to comply with the content and intent of this SWMS may result in injury to persons or damage to equipment', initialRisk: 'M-8', controls: "Ongoing inspections by Engineering Surveys' supervisors and other staff will be conducted to ensure all members of the team involved with this work are compliant with the requirements of this SWMS.", residualRisk: 'L-2' },
    ] },
    { process: 'General — Environmental or hazard change', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Environment changes or new hazards identified not appearing in this SWMS — resulting in unacceptable risk', initialRisk: 'M-8', controls: 'Work is to cease immediately when the environment changes and there is an identified need to re-assess exposure to risk. Immediately notify the supervisor, who will in consultation with the work group review this SWMS and submit changes to ES Managers for review and approval.', residualRisk: 'L-2' },
    ] },
];

// ---- DIT ----
const DIT_DB = [
    { process: 'ALL STEPS / CONTINUOUS — COVID-19 Pandemic Management', actionBy: 'Everyone', hazards: [
        { hazard: 'Spread of COVID-19 virus — risk of infection to workers and the public', initialRisk: 'H-12', controls: 'Follow all current government and DIT COVID-19 guidelines.\nMaintain 1.5 m social distancing at all times.\nWash hands regularly or use hand sanitiser.\nDo not attend site if unwell or displaying symptoms.\nWear face mask where required by regulations.\nComplete health screening / sign-on as required by the client.', residualRisk: 'L-2' },
    ] },
    { process: 'Access site — rail environment; sign on with PTS Rail Safety Officer', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Personnel unaware of site conditions, rules and specific rail safety hazards', initialRisk: 'H-16', controls: 'Industry induction training (white card).\nAttend site specific safety induction; read, understand & sign on to SWMS.\nMust hold current Pegasus card (Rail Induction).\nSign on with PTS Rail Safety Officer before accessing rail corridor.\nAll ARTC / DIT site-specific requirements to be complied with.\nWear appropriate PPE: high visibility clothing, long sleeves, long pants, ankle high lace-up safety boots.', residualRisk: 'M-4' },
        { hazard: 'Extreme weather conditions — potential for wildfire', initialRisk: 'H-16', controls: 'Refer to Extreme Weather Fire policy.\nCease work immediately if fire risk is elevated; follow emergency evacuation procedures.', residualRisk: 'M-4' },
        { hazard: 'Extreme heat days — heat stroke, sunburn; thunderstorms — lightning strikes', initialRisk: 'H-12', controls: 'Drinking plenty of water; wearing sun-hat/hard-hat, sunscreen. Monitor dehydration signs (urine colour).\nAbove 35°C take regular breaks in the shade.\nCease work immediately during lightning; seek refuge inside buildings.', residualRisk: 'M-4' },
        { hazard: 'Wet weather — slippery environment; potential to lose footing and fall/slip; working adjacent private property', initialRisk: 'M-3', controls: 'Walk steadily and slowly; footwear in good condition. Do not run.\nWhen entering private property, be polite; direct any questions to DIT.', residualRisk: 'L-2' },
    ] },
    { process: 'Mobilise equipment for survey — remove from vehicle; carry total station and target(s) to survey control locations', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Being hit by traffic whilst retrieving equipment from vehicle', initialRisk: 'H-12', controls: 'Access equipment from passenger side of vehicle.\nSurvey vehicle to be parked in appropriate and legal location, preferably off roadway.\nWear appropriate PPE: high vis clothing & safety boots.', residualRisk: 'M-3' },
        { hazard: 'Strain from carrying heavy equipment', initialRisk: 'M-6', controls: 'Use fitted back-strap attachments to carry total station box as a backpack.', residualRisk: 'L-2' },
    ] },
    { process: 'Set up GPS Device / total station', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Slip/trip during equipment setup', initialRisk: 'M-9', controls: 'Ensure clear access. Set up clear of vehicle driveways/access ways.', residualRisk: 'M-3' },
        { hazard: 'Personnel struck by vehicles', initialRisk: 'H-16', controls: 'Set up clear of vehicle driveways/access ways. Hi-vis clothing at all times.', residualRisk: 'M-4' },
        { hazard: 'Falling branches', initialRisk: 'H-12', controls: 'Do not set up underneath canopies of trees.', residualRisk: 'M-3' },
    ] },
    { process: 'Opening PSM covers', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Sharp edges on PSM cover or cavity', initialRisk: 'M-9', controls: 'Wear gloves; use appropriate device to open cover.', residualRisk: 'M-3' },
        { hazard: 'Snakes, spiders, scorpions, etc. inside PSM cavity', initialRisk: 'H-12', controls: 'Wear gloves; visual check of cavity first; use device other than hands to clear out dirt etc. unless certain of no danger.', residualRisk: 'M-4' },
    ] },
    { process: 'Placing survey control (e.g. droppers, G.I. nails, masonry nails)', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Eye injury from flying debris whilst hammering nails/droppers', initialRisk: 'M-8', controls: 'Safety glasses to AS1337 to be worn at all times.', residualRisk: 'M-4' },
    ] },
    { process: 'Mark up with paint', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Flammable material; poison due to inhalation of spray paint fumes', initialRisk: 'M-8', controls: 'Refer to MSDS for storage & exposure levels. Use in ventilated/open areas.', residualRisk: 'M-4' },
    ] },
    { process: 'Levelling', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Electrocution: steel levelling staff coming in contact with overhead power lines', initialRisk: 'H-15', controls: 'Surveyor & assistant to be aware of location of power lines at all times.\nStaff kept at minimum possible height at all times.\nALWAYS LOOK ABOVE BEFORE LIFTING STAFF.', residualRisk: 'M-5' },
    ] },
    { process: 'Topographical / Detail Survey', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Working near steep banks/excavations — fall from height', initialRisk: 'H-12', controls: 'Banks not to be traversed; survey base and do not climb to next string location.\nSurvey of bank top to be accessed only if grade of slope is not severe; consider survey using remote measurements.', residualRisk: 'M-4' },
        { hazard: 'Working in densely vegetated areas — eye injury from protruding branches', initialRisk: 'M-8', controls: 'Wear safety glasses when required.', residualRisk: 'M-4' },
        { hazard: 'Working on major roads — being hit by traffic; causing hazard to motorists', initialRisk: 'H-12', controls: 'Traffic Management to be implemented whilst working in trafficable areas.', residualRisk: 'M-4' },
        { hazard: 'Working on minor roads / driveway entrances — being hit by traffic', initialRisk: 'M-8', controls: 'Traffic Management to be implemented. Be visible at all times. Hi-vis clothing.', residualRisk: 'M-3' },
    ] },
    { process: 'Survey of Rail Gauge / access across live rail track', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Being hit by a train while accessing or working across live rail track', initialRisk: 'H-15', controls: 'No access to live rail track unless a qualified Track Protection Officer (TPO) is present and has issued a Track Occupancy Authority (TOA).\nAll personnel to be clear of track before TPO gives all-clear.\nObey all signals and instructions from the PTS Rail Safety Officer.\nWear high-visibility PPE at all times within the rail corridor.', residualRisk: 'M-5' },
    ] },
    { process: 'Aerial Survey — drone operations', actionBy: 'David Topfer', hazards: [
        { hazard: 'Collision with vehicles, persons or other aircraft during drone flight', initialRisk: 'H-12', controls: 'Complete risk assessment / JSA and obtain flight authorisation prior to operations.\nComply with CASA Part 101 regulations and any site-specific airspace restrictions.\nEstablish ground exclusion zones; use a spotter.\nDo not fly over people, moving vehicles or beyond visual line of sight without CASA approval.\nCheck for NOTAM and temporary flight restrictions before each flight.', residualRisk: 'L-2' },
    ] },
];

// ---- CONCRETE SCANNING ----
const CONCRETE_DB = [
    { process: 'Access site', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Personnel unaware of site conditions, rules and specific hazards', initialRisk: 'H-16', controls: 'Industry induction training (white card).\nAttend site specific safety induction training; read, understand & sign on to SWMS.\nWearing appropriate PPE: as a minimum approved high visibility clothing, long sleeves, long pants, ankle high lace-up safety boots.\nSign in to site register / Daily Pre Start.', residualRisk: 'M-4' },
        { hazard: 'Environmental conditions — extreme heat days, heat stroke, sunburn; thunderstorms, lightning strikes', initialRisk: 'M-10', controls: 'Drinking plenty of water; wearing sun-hat/hard-hat, sunscreen. Monitor dehydration signs (urine colour).\nAbove 35°C take regular breaks in the shade.\nCease work immediately during thunderstorm; seek refuge inside buildings.', residualRisk: 'M-5' },
        { hazard: 'Wet weather conditions — wet and slippery environment; potential to lose footing and fall/slip', initialRisk: 'M-3', controls: 'Walk steadily and slowly; footwear in good condition. Do not run.', residualRisk: 'M-3' },
    ] },
    { process: 'Mobilise concrete scanning equipment — remove from vehicle; carry IDS concrete scanner to scanning area', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Being hit by traffic whilst retrieving equipment from vehicle', initialRisk: 'H-12', controls: 'Access equipment from passenger side of vehicle.\nSurvey vehicle to be parked in appropriate and legal location, preferably off roadway.\nWear appropriate PPE: high vis clothing & safety boots.', residualRisk: 'M-3' },
        { hazard: 'Strain from carrying concrete scanning equipment', initialRisk: 'M-6', controls: 'Use fitted back-strap attachments to carry equipment as a backpack, or carry in both hands to distribute weight evenly.\nUse trolley for heavy scanner units where available.', residualRisk: 'L-2' },
    ] },
    { process: 'Set up concrete scanning equipment in scanning area', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Slip/trip hazard during equipment setup in scanning area', initialRisk: 'M-9', controls: 'Ensure clear access; remove trip hazards from the scanning path before commencing.\nWear ankle-high safety boots.', residualRisk: 'M-3' },
        { hazard: 'Personnel struck by vehicles in active or trafficked area', initialRisk: 'H-16', controls: 'Set up and scan clear of vehicle driveways/access ways.\nHi-vis clothing at all times. Implement Traffic Management Plan where required.', residualRisk: 'M-4' },
        { hazard: 'Falling branches or overhead objects in outdoor scanning areas', initialRisk: 'H-12', controls: 'Inspect overhead area before commencing work.\nDo not set up directly underneath overhanging structures or trees with dead branches.', residualRisk: 'M-3' },
    ] },
    { process: 'Scanning concrete surface using IDS ground-penetrating radar scanner', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Dust inhalation or flying debris when scanning deteriorated or damaged concrete surfaces', initialRisk: 'M-9', controls: 'Wear dust mask / P2 respirator when scanning dusty or deteriorated concrete surfaces.\nWear safety glasses at all times during scanning operations.\nDo not scan surfaces that are structurally unsafe without prior engineering assessment.', residualRisk: 'M-3' },
        { hazard: 'Contact with live electrical conduits, post-tension cables or reinforcement during scanning or subsequent works', initialRisk: 'H-12', controls: 'Identify and mark all detected services / structural elements clearly before any penetration or cutting works.\nNever drill, cut, or core without review of scan results by a competent person.\nKeep scan results on site for reference during any follow-up works.\nNotify client/principal contractor of all detected hazardous services.', residualRisk: 'M-4' },
    ] },
    { process: 'Marking scan results on concrete surface', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Incorrect marking or misinterpretation of scan data leading to structural damage or service strike during follow-up works', initialRisk: 'M-8', controls: 'Only competent, trained personnel to interpret and mark up GPR scan results.\nDouble-check all markings against scan data before sign-off.\nClearly label detected services (type, depth, orientation) in accordance with client requirements.\nProvide written report with annotated plan to client — do not rely on site markings alone.\nEnsure markings are durable and visible for the duration of follow-up works.', residualRisk: 'M-4' },
    ] },
    { process: 'Data recording and reporting of scan results', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Data loss or incorrect interpretation of scan records leading to inaccurate reporting and potential safety risk', initialRisk: 'M-8', controls: 'Save all raw scan data to at least two locations (device + cloud/USB backup) immediately after scanning.\nReview all scan files before leaving site to confirm complete coverage.\nPrepare written report with annotated drawings reviewed by the project surveyor / senior technician.\nIssue final report to client with clear limitations and scope of works statement.\nRetain all project data in accordance with company records management policy.', residualRisk: 'M-4' },
    ] },
];

// ---- UNDERGROUND SERVICES ----
const UNDERGROUND_DB = [
    { process: 'Access site', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Personnel unaware of site conditions, rules and specific hazards', initialRisk: 'H-16', controls: 'Industry induction training (white card).\nAttend site specific safety induction training; read, understand & sign on to SWMS.\nWearing appropriate PPE: as a minimum approved high visibility clothing, long sleeves, long pants, ankle high lace-up safety boots.\nSign in to Daily Pre Start.', residualRisk: 'M-4' },
        { hazard: 'Extreme weather conditions — potential for wildfire', initialRisk: 'H-16', controls: 'Refer to Extreme Weather Fire policy.\nCease work immediately if fire risk is elevated; follow emergency evacuation procedures.', residualRisk: 'M-4' },
        { hazard: 'Extreme heat days — heat stroke, sunburn; thunderstorms — lightning strikes', initialRisk: 'H-12', controls: 'Drinking plenty of water; wearing sun-hat/hard-hat, sunscreen. Monitor dehydration signs (urine colour).\nAbove 35°C take regular breaks in the shade.\nCease work immediately during lightning; seek refuge inside buildings.', residualRisk: 'M-4' },
        { hazard: 'Wet weather — slippery environment; potential to lose footing and fall/slip; working adjacent private property', initialRisk: 'M-3', controls: 'Walk steadily and slowly; footwear in good condition. Do not run.\nWhen entering private property, be polite; obtain permission from owner before entering.', residualRisk: 'L-2' },
    ] },
    { process: 'Mobilise equipment for survey — remove from vehicle; carry total station and target(s) to survey control locations', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Being hit by traffic whilst retrieving equipment from vehicle', initialRisk: 'H-12', controls: 'Access equipment from passenger side of vehicle.\nSurvey vehicle to be parked in appropriate and legal location, preferably off roadway.\nWear appropriate PPE: high vis clothing & safety boots.', residualRisk: 'M-3' },
        { hazard: 'Strain from carrying heavy equipment', initialRisk: 'M-6', controls: 'Use fitted back-strap attachments to carry total station box as a backpack.', residualRisk: 'L-2' },
    ] },
    { process: 'Set up GPS Device / total station', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Slip/trip during equipment setup', initialRisk: 'M-9', controls: 'Ensure clear access. Set up clear of vehicle driveways/access ways.', residualRisk: 'M-3' },
        { hazard: 'Personnel struck by vehicles', initialRisk: 'H-16', controls: 'Set up clear of vehicle driveways/access ways. Hi-vis clothing at all times.', residualRisk: 'M-4' },
        { hazard: 'Falling branches', initialRisk: 'H-12', controls: 'Do not set up underneath canopies of trees.', residualRisk: 'M-3' },
    ] },
    { process: 'Opening PSM covers', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Sharp edges on PSM cover or cavity', initialRisk: 'M-9', controls: 'Wear gloves; use appropriate device to open cover.', residualRisk: 'M-3' },
        { hazard: 'Snakes, spiders, scorpions, etc. inside PSM cavity', initialRisk: 'H-12', controls: 'Wear gloves; visual check of cavity first; use device other than hands to clear out dirt etc. unless certain of no danger.', residualRisk: 'M-4' },
    ] },
    { process: 'Placing survey control (e.g. droppers, G.I. nails, masonry nails)', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Eye injury from flying debris whilst hammering nails/droppers', initialRisk: 'M-8', controls: 'Safety glasses to AS1337 to be worn at all times.', residualRisk: 'M-4' },
    ] },
    { process: 'Mark up with paint', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Flammable material; poison due to inhalation of spray paint fumes', initialRisk: 'M-8', controls: 'Refer to MSDS for storage & exposure levels. Use in ventilated/open areas.', residualRisk: 'M-4' },
    ] },
    { process: 'Levelling', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Electrocution: steel levelling staff coming in contact with overhead power lines', initialRisk: 'H-15', controls: 'Surveyor & assistant to be aware of location of power lines at all times.\nStaff kept at minimum possible height at all times.\nALWAYS LOOK ABOVE BEFORE LIFTING STAFF.', residualRisk: 'M-5' },
    ] },
    { process: 'Topographical / Detail Survey', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Working near steep banks/excavations — fall from height', initialRisk: 'H-12', controls: 'Banks not to be traversed; survey base and do not climb to next string location.\nSurvey of bank top to be accessed only if grade of slope is not severe; consider survey using remote measurements.', residualRisk: 'M-4' },
        { hazard: 'Working in densely vegetated areas — eye injury from protruding branches', initialRisk: 'M-8', controls: 'Wear safety glasses when required.', residualRisk: 'M-4' },
        { hazard: 'Working on major roads — being hit by traffic; causing hazard to motorists', initialRisk: 'H-12', controls: 'Traffic Management to be implemented whilst working in trafficable areas.', residualRisk: 'M-4' },
        { hazard: 'Working on minor roads / driveway entrances — being hit by traffic', initialRisk: 'M-8', controls: 'Traffic Management to be implemented. Be visible at all times. Hi-vis clothing.', residualRisk: 'M-3' },
    ] },
    { process: 'Aerial Survey — drone operations', actionBy: 'All ES staff attending site', hazards: [
        { hazard: 'Collision with vehicles, persons or other aircraft during drone flight', initialRisk: 'H-12', controls: 'Complete risk assessment / JSA and obtain CASA flight authorisation prior to operations.\nComply with CASA Part 101 regulations and any site-specific airspace restrictions.\nEstablish ground exclusion zones; use a spotter.\nDo not fly over people, moving vehicles or beyond visual line of sight without CASA approval.\nCheck for NOTAM and temporary flight restrictions before each flight.', residualRisk: 'L-2' },
    ] },
    { process: 'Mobilise service locating equipment — remove from vehicle and prepare for use', actionBy: 'Service Locator', hazards: [
        { hazard: 'Being hit by traffic whilst unloading equipment from vehicle', initialRisk: 'H-12', controls: 'Access equipment from passenger side of vehicle.\nSurvey vehicle to be parked in appropriate and legal location, preferably off roadway.\nWear appropriate PPE: high vis clothing & safety boots.\nTraffic Management to be implemented where required.', residualRisk: 'M-3' },
        { hazard: 'Strain injury from handling heavy service locating equipment', initialRisk: 'M-6', controls: 'Use mechanical aids where available. Lift with correct technique — bend knees, keep back straight.\nDistribute weight evenly; use two-person lift for heavy items.', residualRisk: 'L-2' },
    ] },
    { process: 'Set up service locating equipment in field', actionBy: 'Service Locator', hazards: [
        { hazard: 'Slip/trip hazard during equipment setup in uneven terrain', initialRisk: 'M-9', controls: 'Ensure clear footing before placing equipment. Wear ankle-high safety boots.\nSet up clear of vehicle driveways/access ways.', residualRisk: 'M-3' },
        { hazard: 'Personnel struck by vehicles whilst setting up equipment in or near road', initialRisk: 'H-16', controls: 'Set up clear of vehicle driveways/access ways. Hi-vis clothing at all times.\nImplement Traffic Management Plan where required.', residualRisk: 'M-4' },
        { hazard: 'Falling branches from overhead trees', initialRisk: 'H-12', controls: 'Do not set up or work directly underneath canopies of trees with dead or overhanging branches.\nInspect overhead hazards before commencing setup.', residualRisk: 'M-3' },
    ] },
    { process: 'Accessing / opening rail signalling pits', actionBy: 'RIC Contractor', hazards: [
        { hazard: 'Electrical hazard — contact with live electrical components or electromagnetic interference with signalling equipment', initialRisk: 'H-12', controls: 'Only RIC-authorised personnel to open rail signalling pits.\nDo not touch any electrical components inside the pit.\nUse non-conductive tools when working near electrical infrastructure.\nNotify the relevant authority before opening signalling pits.\nEnsure isolation/permit to work if required.', residualRisk: 'M-3' },
        { hazard: 'Sharp edges on pit cover or inside cavity causing cuts/lacerations', initialRisk: 'M-9', controls: 'Wear cut-resistant gloves when handling pit covers.\nUse appropriate lifting device/key to open covers — do not use bare hands to lift sharp-edged lids.', residualRisk: 'M-3' },
        { hazard: 'Snakes, spiders or other animals inside pit cavity', initialRisk: 'H-12', controls: 'Wear gloves; visually inspect cavity using torch before reaching in.\nUse device other than hands to clear debris unless certain of no danger.', residualRisk: 'M-3' },
    ] },
    { process: 'Opening utility covers / access lids to locate services', actionBy: 'Service Locator', hazards: [
        { hazard: 'Sharp edges on utility cover or cavity causing cuts/lacerations', initialRisk: 'M-9', controls: 'Wear cut-resistant gloves when handling covers.\nUse appropriate lid-lifting key or device — do not use bare hands.\nInspect cover edges for sharp protrusions before handling.', residualRisk: 'M-3' },
        { hazard: 'Snakes, spiders or other animals inside utility pit cavity', initialRisk: 'H-12', controls: 'Wear gloves; use a torch to visually inspect cavity before reaching in.\nUse a device other than hands to clear debris unless certain of no danger.', residualRisk: 'M-4' },
    ] },
    { process: 'Placing earth pin / ground stake for service locating signal induction', actionBy: 'Service Locator', hazards: [
        { hazard: 'Accidental underground service strike whilst driving earth pin into ground', initialRisk: 'M-8', controls: 'Conduct dial-before-you-dig search prior to operations.\nDo not drive earth pin in areas of known underground service congestion without prior clearance.\nUse shallow penetration only (max. 150 mm) unless area has been confirmed clear.\nHave emergency response plan available.', residualRisk: 'M-4' },
    ] },
    { process: 'Mark up located services with spray paint on ground surface', actionBy: 'Service Locator', hazards: [
        { hazard: 'Flammable aerosol material; inhalation of spray paint fumes causing respiratory irritation or poisoning', initialRisk: 'M-8', controls: 'Refer to MSDS/SDS for spray paint — observe storage, handling and exposure limits.\nUse only in well-ventilated/open areas.\nWear dust mask or respirator if working in enclosed or poorly ventilated areas.\nDo not use near open flame or ignition sources.\nDispose of empty canisters in accordance with local regulations.', residualRisk: 'M-4' },
    ] },
];

// Per-template config: label + default equipment / PPE selections, default HRCW "Yes"
// items (1-based indexes into HIGH_RISK_ITEMS), and the process library.
export const TEMPLATES = {
    standard: {
        key: 'standard', label: 'Standard', icon: '📋', accent: '#4a90d9',
        equipment: [
            { label: 'Trimble robotic total station', checked: true },
            { label: 'Trimble controller', checked: true },
            { label: 'Tripod legs', checked: true },
            { label: 'DJI Matrice V2 drone', checked: false },
            { label: 'GPS rover / GPS base', checked: false },
            { label: 'Prism targets', checked: true },
            { label: 'Automatic level & staff', checked: false },
            { label: 'Service locator equipment', checked: false },
        ],
        ppe: [
            { label: 'High visibility safety vest or clothing', checked: true },
            { label: 'Gaiters', checked: false },
            { label: 'Long pants and sleeves', checked: true },
            { label: 'Fall arrest system', checked: false },
            { label: 'Steel cap safety boots — lace up only', checked: true },
            { label: 'Waders', checked: false },
            { label: 'Hard hat', checked: true },
            { label: 'Personal floatation device (PFD)', checked: false },
            { label: 'Hearing protection', checked: true },
            { label: 'Hand protection', checked: true },
            { label: 'Safety glasses', checked: true },
        ],
        highRiskYes: [],
        db: STANDARD_DB,
    },
    dit: {
        key: 'dit', label: 'DIT Survey', icon: '🏗', accent: '#27ae60',
        equipment: [
            { label: 'Trimble robotic total station', checked: true },
            { label: 'Trimble controller', checked: true },
            { label: 'Tripod legs', checked: true },
            { label: 'Survey Drone', checked: true },
            { label: 'GPS rover / GPS base', checked: true },
            { label: 'Prism targets', checked: true },
            { label: 'Automatic level & staff', checked: true },
            { label: 'Service locator equipment', checked: true },
        ],
        ppe: [
            { label: 'High visibility safety vest or clothing', checked: true },
            { label: 'Gaiters', checked: false },
            { label: 'Long pants and sleeves', checked: true },
            { label: 'Fall arrest system', checked: false },
            { label: 'Steel cap safety boots — lace up only', checked: true },
            { label: 'Waders', checked: false },
            { label: 'Hard hat', checked: false },
            { label: 'Personal floatation device (PFD)', checked: false },
            { label: 'Hearing protection', checked: false },
            { label: 'Hand protection', checked: false },
            { label: 'Safety glasses', checked: false },
        ],
        highRiskYes: [12, 15],
        db: DIT_DB,
    },
    concrete: {
        key: 'concrete', label: 'Concrete Scanning', icon: '🔬', accent: '#e67e22',
        equipment: [
            { label: 'Trimble robotic total station', checked: false },
            { label: 'Trimble controller', checked: false },
            { label: 'Tripod legs', checked: false },
            { label: 'Vacuum Truck', checked: false },
            { label: 'GPS rover / GPS base', checked: false },
            { label: 'Prism targets', checked: false },
            { label: 'Automatic level & staff', checked: false },
            { label: 'IDS c-thrue Concrete scanner', checked: true },
        ],
        ppe: [
            { label: 'High visibility safety vest or clothing', checked: true },
            { label: 'Gaiters', checked: false },
            { label: 'Long pants and sleeves', checked: true },
            { label: 'Fall arrest system', checked: false },
            { label: 'Steel cap safety boots — lace up only', checked: true },
            { label: 'Waders', checked: false },
            { label: 'Hard hat', checked: false },
            { label: 'Personal floatation device (PFD)', checked: false },
            { label: 'Hearing protection', checked: false },
            { label: 'Hand protection', checked: true },
            { label: 'Safety glasses', checked: false },
            { label: 'Dust / particle mask', checked: true },
        ],
        highRiskYes: [7, 15, 16],
        db: CONCRETE_DB,
    },
    underground: {
        key: 'underground', label: 'Underground Services', icon: '🌐', accent: '#8e44ad',
        equipment: [
            { label: 'Trimble robotic total station', checked: true },
            { label: 'Trimble controller', checked: true },
            { label: 'Tripod legs', checked: true },
            { label: 'Survey Drone', checked: true },
            { label: 'GPS rover / GPS base', checked: true },
            { label: 'Prism targets', checked: true },
            { label: 'Automatic level & staff', checked: true },
            { label: 'Service locator equipment', checked: true },
        ],
        ppe: [
            { label: 'High visibility safety vest or clothing', checked: true },
            { label: 'Gaiters', checked: false },
            { label: 'Long pants and sleeves', checked: true },
            { label: 'Fall arrest system', checked: false },
            { label: 'Steel cap safety boots — lace up only', checked: true },
            { label: 'Waders', checked: false },
            { label: 'Hard hat', checked: false },
            { label: 'Personal floatation device (PFD)', checked: false },
            { label: 'Hearing protection', checked: false },
            { label: 'Hand protection', checked: false },
            { label: 'Safety glasses', checked: false },
        ],
        highRiskYes: [12, 15],
        db: UNDERGROUND_DB,
    },
};

export const TEMPLATE_ORDER = ['standard', 'dit', 'concrete', 'underground'];

// Flat hazard + control lookup maps for a template's DB, used by the field autocomplete.
export const buildLookups = (db) => {
    const hazardMap = {};
    const controlMap = {};
    (db || []).forEach((entry) => {
        entry.hazards.forEach((h) => {
            hazardMap[h.hazard.toLowerCase().trim()] = { ...h, process: entry.process, actionBy: entry.actionBy };
            const cKey = h.controls.toLowerCase().trim().slice(0, 60);
            controlMap[cKey] = { ...h, process: entry.process, actionBy: entry.actionBy };
        });
    });
    return { hazardMap, controlMap, allHazards: Object.values(hazardMap) };
};

// Every process across every template, flattened for the Process Library search.
export const allLibraryEntries = () =>
    TEMPLATE_ORDER.flatMap((key) => {
        const tpl = TEMPLATES[key];
        return tpl.db.map((entry, dbIdx) => ({
            tplKey: key, tplLabel: tpl.label, tplAccent: tpl.accent, tplIcon: tpl.icon,
            dbIdx, process: entry.process, actionBy: entry.actionBy, hazards: entry.hazards,
        }));
    });

// One control measure per line, each prefixed with "• " (strips existing bullet markers).
export const formatControlMeasuresLines = (text) => {
    const out = [];
    String(text || '').split(/\r?\n/).forEach((line) => {
        const t = line.trim().replace(/^[•·‣●\-*●]\s*/, '');
        if (t) out.push('• ' + t);
    });
    return out.join('\n');
};

// Risk band ('H' | 'M' | 'L' | '') from a rating code like "H-12".
export const riskBand = (code) => {
    const first = String(code || '').trim().toUpperCase().split(/[\s,]+/)[0] || '';
    if (first.startsWith('H') || first.startsWith('V')) return 'H';
    if (first.startsWith('M')) return 'M';
    if (first.startsWith('L')) return 'L';
    return '';
};
