window.CadminDemoData = (function () {
    const TAG_SYSTEM = "https://cadmin.io/fhir/tags";
    const TAG_CODE = "demo-data";
    const TAG_DISPLAY = "Demo data";
    const PRIMARY_TYPES = [
        { key: "organization", type: "Organization", label: "Organizations", icon: "bi-building" },
        { key: "location", type: "Location", label: "Locations", icon: "bi-geo-alt" },
        { key: "practitioner", type: "Practitioner", label: "Practitioners", icon: "mdi:doctor" },
        { key: "patient", type: "Patient", label: "Patients", icon: "bi-people" },
        { key: "caregiver", type: "RelatedPerson", label: "Caregivers", icon: "bi-person-heart" },
        { key: "careTeam", type: "CareTeam", label: "Care teams", icon: "bi-people-fill" },
        { key: "device", type: "Device", label: "Devices", icon: "mdi:devices" }
    ];
    const PURGE_TYPES = [
        "DeviceAssociation",
        "PractitionerRole",
        "OrganizationAffiliation",
        "Endpoint",
        "Questionnaire",
        "CareTeam",
        "Device",
        "RelatedPerson",
        "Patient",
        "Practitioner",
        "Location",
        "Organization"
    ];
    const FEMALE_GIVEN = [
        "Ava", "Maya", "Sofia", "Elena", "Priya", "Hannah", "Grace", "Amelia", "Olivia",
        "Chloe", "Isabella", "Zoe", "Nora", "Lila", "Camila", "Naomi", "Imani", "Leah",
        "Harper", "Mia", "Aisha", "Juniper", "Sienna", "Freya"
    ];
    const MALE_GIVEN = [
        "James", "Mateo", "Noah", "Liam", "Ethan", "Owen", "Kai", "Andre", "Marcus",
        "Julian", "Theo", "Samuel", "Diego", "Henry", "Isaac", "Omar", "Caleb", "Jonah",
        "Adrian", "Leo", "Nolan", "Felix", "Rafael", "Miles", "Asher"
    ];
    const FAMILY = [
        "Nguyen", "Patel", "Garcia", "Kim", "Johnson", "Okafor", "Rossi", "Andersson",
        "Chen", "Williams", "Hernandez", "Kowalski", "Nakamura", "Ali", "Brooks",
        "Santos", "Murphy", "Ibrahim", "Singh", "Costa", "Bennett", "Vargas", "Park",
        "Dubois", "Rahman", "Keller", "Mwangi", "Torres", "Hughes"
    ];
    const PLACES = [
        { city: "Portland", state: "OR", postal: "97201", area: "503" },
        { city: "Austin", state: "TX", postal: "78701", area: "512" },
        { city: "Madison", state: "WI", postal: "53703", area: "608" },
        { city: "Durham", state: "NC", postal: "27701", area: "919" },
        { city: "Boise", state: "ID", postal: "83702", area: "208" },
        { city: "Ann Arbor", state: "MI", postal: "48104", area: "734" },
        { city: "Boulder", state: "CO", postal: "80302", area: "303" },
        { city: "Savannah", state: "GA", postal: "31401", area: "912" },
        { city: "Providence", state: "RI", postal: "02903", area: "401" },
        { city: "Santa Fe", state: "NM", postal: "87501", area: "505" }
    ];
    const STREETS = ["Oak", "Maple", "Cedar", "Pine", "Willow", "Harbor", "Summit", "Lakeview", "Highland", "River", "Market", "College"];
    const STREET_TYPES = ["St", "Ave", "Blvd", "Rd", "Way", "Ln"];
    const ORG_KINDS = [
        { suffix: "General Hospital", type: "prov", display: "Healthcare Provider" },
        { suffix: "Community Clinic", type: "prov", display: "Healthcare Provider" },
        { suffix: "Family Medicine", type: "prov", display: "Healthcare Provider" },
        { suffix: "Regional Health", type: "prov", display: "Healthcare Provider" },
        { suffix: "Medical Group", type: "prov", display: "Healthcare Provider" }
    ];
    const LOC_KINDS = [
        { suffix: "Main Campus", form: "si", display: "Site" },
        { suffix: "North Wing", form: "wi", display: "Wing" },
        { suffix: "Primary Care", form: "bu", display: "Building" },
        { suffix: "Cardiology Ward", form: "wa", display: "Ward" },
        { suffix: "Level 3", form: "lvl", display: "Level" },
        { suffix: "Infusion Suite", form: "ro", display: "Room" }
    ];
    const PRACTITIONER_ROLES = [
        { code: "doctor", display: "Doctor" },
        { code: "nurse", display: "Nurse" },
        { code: "pharmacist", display: "Pharmacist" },
        { code: "researcher", display: "Researcher" }
    ];
    const CAREGIVER_ROLES = [
        { code: "CARGVR", display: "Caregiver" },
        { code: "PRN", display: "Parent" },
        { code: "SPS", display: "Spouse" },
        { code: "NOK", display: "Next of kin" },
        { code: "FRND", display: "Friend" }
    ];
    const ENDPOINT_KINDS = [
        { code: "hl7-fhir-rest", display: "HL7 FHIR REST", path: "/fhir" },
        { code: "hl7-fhir-msg", display: "HL7 FHIR Messaging", path: "/fhir/$process-message" }
    ];
    const DEVICE_KINDS = [
        { name: "Omron Platinum BP", manufacturer: "Omron", model: "BP5450", code: "336602003", display: "Blood pressure cuff" },
        { name: "Dexcom G7", manufacturer: "Dexcom", model: "G7", code: "337414009", display: "Blood glucose meter" },
        { name: "Masimo MightySat", manufacturer: "Masimo", model: "MightySat Rx", code: "706767009", display: "Pulse oximeter" },
        { name: "Medtronic MiniMed", manufacturer: "Medtronic", model: "780G", code: "468039003", display: "Infusion pump" },
        { name: "Philips Holter", manufacturer: "Philips", model: "Extended Holter", code: "86184003", display: "Electrocardiographic monitor" },
        { name: "ResMed AirSense", manufacturer: "ResMed", model: "11", code: "463844008", display: "Ventilator" }
    ];

    function tagToken() {
        return TAG_SYSTEM + "|" + TAG_CODE;
    }

    function demoTag() {
        return { system: TAG_SYSTEM, code: TAG_CODE, display: TAG_DISPLAY };
    }

    function withDemoMeta(resource) {
        resource.meta = resource.meta || {};
        resource.meta.tag = (resource.meta.tag || []).concat([demoTag()]);
        return resource;
    }

    function defaultSelection() {
        return {
            organization: { enabled: true, count: 2 },
            location: { enabled: true, count: 3 },
            practitioner: { enabled: true, count: 3 },
            patient: { enabled: true, count: 5 },
            caregiver: { enabled: true, count: 2 },
            careTeam: { enabled: true, count: 5 },
            device: { enabled: true, count: 3 }
        };
    }

    function clampCount(value) {
        const n = parseInt(value, 10);
        if (!n || n < 1) {
            return 1;
        }
        return n > 25 ? 25 : n;
    }

    function createRng(seed) {
        let s = (Number(seed) || 1) >>> 0;
        if (!s) {
            s = 1;
        }
        return function () {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            return s / 4294967296;
        };
    }

    function pick(random, list) {
        return list[Math.floor(random() * list.length)];
    }

    function pad(value) {
        return value < 10 ? "0" + value : String(value);
    }

    function birthDate(random, minYear, maxYear) {
        const year = minYear + Math.floor(random() * (maxYear - minYear + 1));
        const month = 1 + Math.floor(random() * 12);
        const day = 1 + Math.floor(random() * 28);
        return year + "-" + pad(month) + "-" + pad(day);
    }

    function streetLine(random) {
        return (100 + Math.floor(random() * 8900)) + " " + pick(random, STREETS) + " " + pick(random, STREET_TYPES);
    }

    function address(random, place, use) {
        return {
            use: use || "work",
            type: "both",
            line: [streetLine(random)],
            city: place.city,
            state: place.state,
            postalCode: place.postal,
            country: "US"
        };
    }

    function formatAddress(value) {
        if (!value) {
            return "";
        }
        return [value.line && value.line[0], value.city, value.state, value.postalCode]
            .filter(Boolean)
            .join(", ");
    }

    function phone(random, area) {
        const exchange = 200 + Math.floor(random() * 700);
        const line = 1000 + Math.floor(random() * 9000);
        return area + "-" + exchange + "-" + line;
    }

    function slug(text) {
        return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
    }

    function personEmail(given, family) {
        return slug(given) + "." + slug(family) + "@example.com";
    }

    function personName(name) {
        const given = ((name && name.given) || []).join(" ");
        return [given, name && name.family].filter(Boolean).join(" ");
    }

    function buildPerson(random, usedNames, genderHint) {
        const roll = random();
        const gender = genderHint || (roll < 0.48 ? "female" : roll < 0.96 ? "male" : "other");
        const pool = gender === "female" ? FEMALE_GIVEN : gender === "male" ? MALE_GIVEN : FEMALE_GIVEN.concat(MALE_GIVEN);
        let given;
        let family;
        let display;
        let attempt = 0;
        do {
            given = pick(random, pool);
            family = pick(random, FAMILY);
            display = given + " " + family;
            attempt += 1;
        } while (usedNames[display] && attempt < 20);
        usedNames[display] = true;
        return {
            gender: gender,
            name: { family: family, given: [given] },
            display: display
        };
    }

    function coding(system, code, display) {
        return { coding: [{ system: system, code: code, display: display }], text: display };
    }

    function referenceOf(created, key) {
        const item = created[key];
        if (!item || !item.id) {
            return null;
        }
        return { reference: item.type + "/" + item.id, display: item.display };
    }

    function normalizeSelection(selection) {
        const counts = {};
        const implied = {};
        PRIMARY_TYPES.forEach(function (item) {
            const entry = (selection && selection[item.key]) || {};
            counts[item.key] = entry.enabled ? clampCount(entry.count) : 0;
        });
        if ((counts.location || counts.practitioner || counts.careTeam) && !counts.organization) {
            counts.organization = 1;
            implied.organization = true;
        }
        if (counts.careTeam && !counts.patient) {
            counts.patient = counts.careTeam;
            implied.patient = true;
        }
        if (counts.caregiver && counts.patient && !counts.careTeam) {
            counts.careTeam = Math.min(counts.patient, Math.max(counts.caregiver, 1));
            implied.careTeam = true;
        } else if (counts.practitioner && counts.patient && !counts.careTeam) {
            counts.careTeam = counts.patient;
            implied.careTeam = true;
        }
        return { counts: counts, implied: implied };
    }

    function addDraft(drafts, draft) {
        drafts.push(draft);
        return draft;
    }

    function buildPlan(selection, seed) {
        const random = createRng(seed);
        const normalized = normalizeSelection(selection);
        const counts = normalized.counts;
        const implied = normalized.implied;
        const drafts = [];
        const associations = [];
        const usedNames = {};
        const orgKeys = [];
        const locKeys = [];
        const locByOrg = {};
        const pracKeys = [];
        const patientKeys = [];
        const caregiverKeys = [];

        function placeFor(index) {
            return PLACES[index % PLACES.length];
        }

        for (let i = 0; i < counts.organization; i += 1) {
            const place = placeFor(i);
            const kind = i === 0 ? ORG_KINDS[0] : ORG_KINDS[(i % (ORG_KINDS.length - 1)) + 1];
            const name = place.city + " " + kind.suffix;
            const addr = address(random, place, "work");
            const key = "org-" + i;
            orgKeys.push(key);
            addDraft(drafts, {
                key: key,
                type: "Organization",
                display: name,
                detail: formatAddress(addr),
                implied: !!implied.organization,
                resource: withDemoMeta({
                    resourceType: "Organization",
                    active: true,
                    name: name,
                    type: [coding(
                        "http://terminology.hl7.org/CodeSystem/organization-type",
                        kind.type,
                        kind.display
                    )],
                    contact: [{
                        telecom: [
                            { system: "phone", value: phone(random, place.area) },
                            { system: "email", value: "info@" + slug(name) + ".example" }
                        ],
                        address: addr
                    }]
                })
            });
        }

        function addEndpoint(opts) {
            const conn = opts.conn;
            addDraft(drafts, {
                key: opts.key,
                type: "Endpoint",
                display: opts.name,
                detail: conn.display + " · " + opts.address,
                implied: true,
                resource: withDemoMeta({
                    resourceType: "Endpoint",
                    status: "active",
                    name: opts.name,
                    address: opts.address,
                    connectionType: [coding(
                        "http://terminology.hl7.org/CodeSystem/endpoint-connection-type",
                        conn.code,
                        conn.display
                    )],
                    payload: [{
                        type: [coding(
                            "http://terminology.hl7.org/CodeSystem/endpoint-payload-type",
                            "any",
                            "Any"
                        )],
                        mimeType: ["application/fhir+json"]
                    }]
                }),
                bind: function (resource, created) {
                    const orgRef = opts.orgKey ? referenceOf(created, opts.orgKey) : null;
                    if (orgRef) {
                        resource.managingOrganization = orgRef;
                    }
                },
                attachTo: {
                    organization: opts.orgKey || "",
                    location: opts.locKey || ""
                }
            });
        }

        if (orgKeys.length) {
            associations.push("Endpoint for each organization");
            orgKeys.forEach(function (orgKey, i) {
                const orgDraft = drafts.find(function (draft) { return draft.key === orgKey; });
                const name = (orgDraft && orgDraft.display) || "Organization";
                const conn = ENDPOINT_KINDS[i % ENDPOINT_KINDS.length];
                addEndpoint({
                    key: "ep-org-" + i,
                    name: name + " FHIR",
                    address: "https://" + slug(name) + ".example" + conn.path,
                    conn: conn,
                    orgKey: orgKey
                });
            });
        }

        if (orgKeys.length >= 2) {
            associations.push("OrganizationAffiliation between the hospital and each clinic");
            for (let i = 1; i < orgKeys.length; i += 1) {
                const parentKey = orgKeys[0];
                const childKey = orgKeys[i];
                addDraft(drafts, {
                    key: "affil-" + i,
                    type: "OrganizationAffiliation",
                    display: "Affiliation",
                    detail: "Clinic participates with hospital",
                    implied: true,
                    resource: withDemoMeta({
                        resourceType: "OrganizationAffiliation",
                        active: true,
                        code: [coding("http://hl7.org/fhir/organization-role", "provider", "Provider")]
                    }),
                    bind: function (resource, created) {
                        const organization = referenceOf(created, parentKey);
                        const participating = referenceOf(created, childKey);
                        if (organization) {
                            resource.organization = organization;
                        }
                        if (participating) {
                            resource.participatingOrganization = participating;
                        }
                    }
                });
            }
        }

        const siteByOrg = {};
        for (let i = 0; i < counts.location; i += 1) {
            const orgIndex = orgKeys.length ? i % orgKeys.length : 0;
            const orgKey = orgKeys[orgIndex];
            const place = placeFor(orgIndex);
            const kind = LOC_KINDS[i % LOC_KINDS.length];
            const isSite = !siteByOrg[orgKey];
            const locKind = isSite ? LOC_KINDS[0] : kind;
            const name = locKind.suffix;
            const addr = address(random, place, "work");
            const key = "loc-" + i;
            locKeys.push(key);
            locByOrg[orgKey] = locByOrg[orgKey] || [];
            locByOrg[orgKey].push(key);
            const partOfKey = isSite ? "" : siteByOrg[orgKey];
            if (isSite) {
                siteByOrg[orgKey] = key;
            }
            addDraft(drafts, {
                key: key,
                type: "Location",
                display: name,
                detail: formatAddress(addr),
                implied: false,
                resource: withDemoMeta({
                    resourceType: "Location",
                    status: "active",
                    name: name,
                    form: coding(
                        "http://terminology.hl7.org/CodeSystem/location-physical-type",
                        locKind.form,
                        locKind.display
                    ),
                    address: addr
                }),
                bind: function (resource, created) {
                    const orgRef = referenceOf(created, orgKey);
                    if (orgRef) {
                        resource.managingOrganization = orgRef;
                    }
                    const parent = partOfKey ? referenceOf(created, partOfKey) : null;
                    if (parent) {
                        resource.partOf = parent;
                    }
                }
            });
        }

        const siteKeys = Object.keys(siteByOrg).map(function (orgKey) {
            return { orgKey: orgKey, locKey: siteByOrg[orgKey] };
        }).filter(function (item) {
            return item.locKey;
        });
        if (siteKeys.length) {
            associations.push("Endpoint for each site location");
            siteKeys.forEach(function (item, i) {
                const locDraft = drafts.find(function (draft) { return draft.key === item.locKey; });
                const orgDraft = drafts.find(function (draft) { return draft.key === item.orgKey; });
                const locName = (locDraft && locDraft.display) || "Site";
                const orgName = (orgDraft && orgDraft.display) || "Organization";
                addEndpoint({
                    key: "ep-loc-" + i,
                    name: orgName + " " + locName + " FHIR",
                    address: "https://" + slug(orgName) + ".example/fhir/" + slug(locName),
                    conn: ENDPOINT_KINDS[0],
                    orgKey: item.orgKey,
                    locKey: item.locKey
                });
            });
        }

        for (let i = 0; i < counts.practitioner; i += 1) {
            const person = buildPerson(random, usedNames);
            const orgKey = orgKeys.length ? orgKeys[i % orgKeys.length] : "";
            const place = placeFor(orgKeys.length ? i % orgKeys.length : 0);
            const addr = address(random, place, "home");
            const role = PRACTITIONER_ROLES[i % PRACTITIONER_ROLES.length];
            const key = "prac-" + i;
            pracKeys.push(key);
            addDraft(drafts, {
                key: key,
                type: "Practitioner",
                display: person.display,
                detail: formatAddress(addr),
                implied: false,
                resource: withDemoMeta({
                    resourceType: "Practitioner",
                    active: true,
                    name: [person.name],
                    gender: person.gender,
                    birthDate: birthDate(random, 1958, 1996),
                    telecom: [
                        { system: "phone", value: phone(random, place.area), use: "work" },
                        { system: "email", value: personEmail(person.name.given[0], person.name.family) }
                    ],
                    address: [addr]
                })
            });
            if (orgKey) {
                const locKey = (locByOrg[orgKey] && locByOrg[orgKey][0]) || locKeys[0] || "";
                addDraft(drafts, {
                    key: "role-" + i,
                    type: "PractitionerRole",
                    display: role.display + " — " + person.display,
                    detail: role.display,
                    implied: true,
                    resource: withDemoMeta({
                        resourceType: "PractitionerRole",
                        active: true,
                        code: [coding(
                            "http://terminology.hl7.org/CodeSystem/practitioner-role",
                            role.code,
                            role.display
                        )]
                    }),
                    bind: function (resource, created) {
                        const practitioner = referenceOf(created, key);
                        const organization = referenceOf(created, orgKey);
                        const location = locKey ? referenceOf(created, locKey) : null;
                        if (practitioner) {
                            resource.practitioner = practitioner;
                        }
                        if (organization) {
                            resource.organization = organization;
                        }
                        if (location) {
                            resource.location = [location];
                        }
                    }
                });
            }
        }
        if (counts.practitioner && orgKeys.length) {
            associations.push("PractitionerRole links each practitioner to an organization" +
                (locKeys.length ? " and location" : ""));
        }

        for (let i = 0; i < counts.patient; i += 1) {
            const person = buildPerson(random, usedNames);
            const place = placeFor(orgKeys.length ? i % orgKeys.length : i);
            const addr = address(random, place, "home");
            const key = "pat-" + i;
            patientKeys.push(key);
            addDraft(drafts, {
                key: key,
                type: "Patient",
                display: person.display,
                detail: formatAddress(addr),
                implied: !!implied.patient,
                orgKey: orgKeys.length ? orgKeys[i % orgKeys.length] : "",
                resource: withDemoMeta({
                    resourceType: "Patient",
                    active: true,
                    name: [person.name],
                    gender: person.gender,
                    birthDate: birthDate(random, 1942, 2018),
                    telecom: [
                        { system: "phone", value: phone(random, place.area), use: "home" },
                        { system: "email", value: personEmail(person.name.given[0], person.name.family) }
                    ],
                    address: [addr]
                })
            });
        }

        for (let i = 0; i < counts.caregiver; i += 1) {
            const person = buildPerson(random, usedNames);
            const place = placeFor(i);
            const addr = address(random, place, "home");
            const role = CAREGIVER_ROLES[i % CAREGIVER_ROLES.length];
            const key = "cg-" + i;
            caregiverKeys.push(key);
            addDraft(drafts, {
                key: key,
                type: "RelatedPerson",
                display: person.display,
                detail: role.display + " · " + formatAddress(addr),
                implied: false,
                role: role,
                resource: withDemoMeta({
                    resourceType: "RelatedPerson",
                    active: true,
                    name: [person.name],
                    gender: person.gender,
                    birthDate: birthDate(random, 1948, 2004),
                    relationship: [coding(
                        "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                        role.code,
                        role.display
                    )],
                    telecom: [
                        { system: "phone", value: phone(random, place.area), use: "mobile" },
                        { system: "email", value: personEmail(person.name.given[0], person.name.family) }
                    ],
                    address: [addr]
                })
            });
        }

        if (counts.careTeam && patientKeys.length) {
            associations.push("CareTeam.subject → Patient; managingOrganization → Organization; " +
                "participants → Practitioner and RelatedPerson");
            for (let i = 0; i < counts.careTeam; i += 1) {
                const patientKey = patientKeys[i % patientKeys.length];
                const patientDraft = drafts.find(function (item) { return item.key === patientKey; });
                const orgKey = (patientDraft && patientDraft.orgKey) || orgKeys[0] || "";
                const pracKey = pracKeys.length ? pracKeys[i % pracKeys.length] : "";
                const cgKey = caregiverKeys.length ? caregiverKeys[i % caregiverKeys.length] : "";
                const given = patientDraft ? (patientDraft.resource.name[0].given[0] || "Patient") : "Patient";
                const family = patientDraft ? (patientDraft.resource.name[0].family || "") : "";
                const name = (family || given) + " Care Team";
                addDraft(drafts, {
                    key: "team-" + i,
                    type: "CareTeam",
                    display: name,
                    detail: "For " + (patientDraft ? patientDraft.display : "patient"),
                    implied: !!implied.careTeam,
                    resource: withDemoMeta({
                        resourceType: "CareTeam",
                        status: "active",
                        name: name,
                        category: [coding(
                            "http://loinc.org",
                            "LA28865-6",
                            "Longitudinal care-coordination"
                        )]
                    }),
                    bind: function (resource, created) {
                        const subject = referenceOf(created, patientKey);
                        if (subject) {
                            resource.subject = subject;
                        }
                        const organization = orgKey ? referenceOf(created, orgKey) : null;
                        if (organization) {
                            resource.managingOrganization = [organization];
                        }
                        const participants = [];
                        const practitioner = pracKey ? referenceOf(created, pracKey) : null;
                        if (practitioner) {
                            const role = PRACTITIONER_ROLES[i % PRACTITIONER_ROLES.length];
                            participants.push({
                                member: practitioner,
                                role: coding(
                                    "http://terminology.hl7.org/CodeSystem/practitioner-role",
                                    role.code,
                                    role.display
                                )
                            });
                        }
                        const caregiver = cgKey ? referenceOf(created, cgKey) : null;
                        if (caregiver) {
                            const cgDraft = drafts.find(function (item) { return item.key === cgKey; });
                            const role = (cgDraft && cgDraft.role) || CAREGIVER_ROLES[0];
                            participants.push({
                                member: caregiver,
                                role: coding(
                                    "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                                    role.code,
                                    role.display
                                )
                            });
                        }
                        if (participants.length) {
                            resource.participant = participants;
                        }
                    }
                });
            }
        }

        if (counts.device) {
            if (patientKeys.length) {
                associations.push("DeviceAssociation attaches each device to a patient");
            }
            for (let i = 0; i < counts.device; i += 1) {
                const kind = DEVICE_KINDS[i % DEVICE_KINDS.length];
                const serial = "DEMO-" + (10000 + Math.floor(random() * 90000));
                const key = "dev-" + i;
                const patientKey = patientKeys.length ? patientKeys[i % patientKeys.length] : "";
                const orgKey = orgKeys.length ? orgKeys[i % orgKeys.length] : "";
                addDraft(drafts, {
                    key: key,
                    type: "Device",
                    display: kind.name,
                    detail: kind.manufacturer + " " + kind.model,
                    implied: false,
                    resource: withDemoMeta({
                        resourceType: "Device",
                        status: "active",
                        name: [{
                            value: kind.name,
                            type: "user-friendly-name",
                            display: true
                        }],
                        manufacturer: kind.manufacturer,
                        modelNumber: kind.model,
                        serialNumber: serial,
                        type: [coding("http://snomed.info/sct", kind.code, kind.display)]
                    }),
                    bind: function (resource, created) {
                        const owner = orgKey ? referenceOf(created, orgKey) : null;
                        if (owner) {
                            resource.owner = owner;
                        }
                    }
                });
                if (patientKey) {
                    addDraft(drafts, {
                        key: "dassoc-" + i,
                        type: "DeviceAssociation",
                        display: kind.name,
                        detail: "Attached to patient",
                        implied: true,
                        resource: withDemoMeta({
                            resourceType: "DeviceAssociation",
                            status: "attached"
                        }),
                        bind: function (resource, created) {
                            const device = referenceOf(created, key);
                            const subject = referenceOf(created, patientKey);
                            if (device) {
                                resource.device = device;
                            }
                            if (subject) {
                                resource.subject = subject;
                            }
                        }
                    });
                }
            }
        }

        const anyPrimary = PRIMARY_TYPES.some(function (item) {
            return counts[item.key] > 0;
        });
        if (anyPrimary) {
            associations.push("Sample Questionnaire forms");
            const phqOptions = [
                { valueCoding: { code: "0", display: "Not at all" } },
                { valueCoding: { code: "1", display: "Several days" } },
                { valueCoding: { code: "2", display: "More than half the days" } },
                { valueCoding: { code: "3", display: "Nearly every day" } }
            ];
            addDraft(drafts, {
                key: "qn-intake",
                type: "Questionnaire",
                display: "Patient intake",
                detail: "About you · allergies follow-up",
                implied: true,
                resource: withDemoMeta({
                    resourceType: "Questionnaire",
                    status: "draft",
                    title: "Patient intake",
                    name: "patient-intake",
                    url: "https://cadmin.io/fhir/Questionnaire/demo-intake",
                    version: "1.0.0",
                    publisher: "Cadmin demo",
                    subjectType: ["Patient"],
                    description: "Basic intake questions for new patients.",
                    item: [{
                        linkId: "about",
                        type: "group",
                        text: "About you",
                        item: [
                            { linkId: "about.given", type: "string", text: "Given name", required: true },
                            { linkId: "about.family", type: "string", text: "Family name", required: true },
                            { linkId: "about.birth", type: "date", text: "Date of birth" },
                            { linkId: "about.allergies", type: "boolean", text: "Do you have any allergies?" },
                            {
                                linkId: "about.allergy-details",
                                type: "text",
                                text: "List your allergies",
                                enableWhen: [{
                                    question: "about.allergies",
                                    operator: "=",
                                    answerBoolean: true
                                }]
                            }
                        ]
                    }]
                })
            });
            addDraft(drafts, {
                key: "qn-phq2",
                type: "Questionnaire",
                display: "PHQ-2 depression screen",
                detail: "Two coding items · 0–3",
                implied: true,
                resource: withDemoMeta({
                    resourceType: "Questionnaire",
                    status: "draft",
                    title: "PHQ-2 depression screen",
                    name: "phq-2",
                    url: "https://cadmin.io/fhir/Questionnaire/demo-phq-2",
                    version: "1.0.0",
                    publisher: "Cadmin demo",
                    subjectType: ["Patient"],
                    description: "Two-item depression screening (PHQ-2 style).",
                    item: [
                        {
                            linkId: "intro",
                            type: "display",
                            text: "Over the last 2 weeks, how often have you been bothered by the following problems?"
                        },
                        {
                            linkId: "interest",
                            type: "coding",
                            text: "Little interest or pleasure in doing things",
                            answerOption: JSON.parse(JSON.stringify(phqOptions))
                        },
                        {
                            linkId: "mood",
                            type: "coding",
                            text: "Feeling down, depressed, or hopeless",
                            answerOption: JSON.parse(JSON.stringify(phqOptions))
                        }
                    ]
                })
            });
        }

        const uniqueAssociations = associations.filter(function (item, index) {
            return associations.indexOf(item) === index;
        });
        const totals = {};
        drafts.forEach(function (draft) {
            totals[draft.type] = (totals[draft.type] || 0) + 1;
        });

        return {
            seed: seed,
            counts: counts,
            implied: implied,
            drafts: drafts,
            associations: uniqueAssociations,
            totals: totals
        };
    }

    function applyBindings(draft, created) {
        const resource = JSON.parse(JSON.stringify(draft.resource));
        if (typeof draft.bind === "function") {
            draft.bind(resource, created);
        }
        return resource;
    }

    function hasPrimarySelection(selection) {
        return PRIMARY_TYPES.some(function (item) {
            const entry = (selection && selection[item.key]) || {};
            return !!entry.enabled;
        });
    }

    return {
        TAG_SYSTEM: TAG_SYSTEM,
        TAG_CODE: TAG_CODE,
        TAG_DISPLAY: TAG_DISPLAY,
        PRIMARY_TYPES: PRIMARY_TYPES,
        PURGE_TYPES: PURGE_TYPES,
        tagToken: tagToken,
        withDemoMeta: withDemoMeta,
        defaultSelection: defaultSelection,
        normalizeSelection: normalizeSelection,
        hasPrimarySelection: hasPrimarySelection,
        buildPlan: buildPlan,
        applyBindings: applyBindings,
        formatAddress: formatAddress,
        personName: personName,
        clampCount: clampCount
    };
}());
