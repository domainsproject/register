const t = require("ava");
const fs = require("fs-extra");
const path = require("path");

const requiredFields = {
    owner: "object",
    record: "object"
};

const optionalOwnerFields = {
    email: "string"
};

const ignoredRootJSONFiles = ["package-lock.json", "package.json"];

const domains = [".owns.it.com"];

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const hostnameRegex = /^(?=.{1,253}$)(?:(?:[_a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)\.)+[a-zA-Z]{2,63}$/;

const domainsPath = path.resolve("domains");
const utilsPath = path.resolve("utils");
const rootDomainFiles = ["owns.it.com.json"];

// Load reserved subdomains list
let reservedSubdomains = [];
try {
    const reservedSubdomainsFile = path.join(utilsPath, "reserved-subdomains.json");
    if (fs.existsSync(reservedSubdomainsFile)) {
        const reservedData = JSON.parse(fs.readFileSync(reservedSubdomainsFile, 'utf8'));
        reservedSubdomains = reservedData.reserved_subdomains || [];
    }
} catch (error) {
    console.warn("Warning: Could not load reserved subdomains list:", error.message);
}

const files = fs.readdirSync(domainsPath);

const Domains = [".owns.it.com"];

function validateRequiredFields(t, obj, requiredFields, file) {
    Object.keys(requiredFields).forEach((key) => {
        t.true(obj.hasOwnProperty(key), `${file}: Missing required field: ${key}`);
        t.is(typeof obj[key], requiredFields[key], `${file}: Field ${key} should be of type ${requiredFields[key]}`);
    });
}

function validateOptionalFields(t, obj, optionalFields, file) {
    Object.keys(optionalFields).forEach((key) => {
        if (obj.hasOwnProperty(key)) {
            t.is(
                typeof obj[key],
                optionalFields[key],
                `${file}: Field ${key} should be of type ${optionalFields[key]}`
            );
        }
    });
}

t("All JSON files must be valid JSON", (t) => {
    const files = fs.readdirSync(domainsPath).filter(file => {
        const filePath = path.join(domainsPath, file);
        return file.endsWith(".json") && fs.lstatSync(filePath).isFile();
    });

    files.forEach(file => {
        const filePath = path.join(domainsPath, file);
        try {
            const data = fs.readFileSync(filePath, "utf8");
            JSON.parse(data);
            t.pass(`${file} is valid JSON`);
        } catch (err) {
            t.fail(`${file} contains invalid JSON: ${err.message}`);
        }
    });
});

t("All files should have the required fields", (t) => {
    const files = fs.readdirSync(domainsPath).filter(file => {
    const filePath = path.join(domainsPath, file);
    return fs.lstatSync(filePath).isFile(); // Ensure only files are included
    });
    files.forEach((file) => {
        const data = fs.readJsonSync(path.join(domainsPath, file));

        validateRequiredFields(t, data, requiredFields, file);

        if (!data.reserved) {
            t.true(Object.keys(data.record).length > 0, `${file}: No record types found`);
        }
    });
});

t("All filenames, subdomains, and domains must be lowercase", (t) => {
    const files = fs.readdirSync(domainsPath).filter(file => {
        const filePath = path.join(domainsPath, file);
        return file.endsWith(".json") && fs.lstatSync(filePath).isFile();
    });

    files.forEach(file => {
        const filePath = path.join(domainsPath, file);
        const data = fs.readJsonSync(filePath);

        // Check filename is lowercase
        t.is(file, file.toLowerCase(), `${file}: Filename must be lowercase`);

        const { subdomain, domain } = data;

        // Check JSON values are lowercase
        t.truthy(subdomain, `${file}: Missing subdomain field`);
        t.truthy(domain, `${file}: Missing domain field`);

        t.is(subdomain, subdomain.toLowerCase(), `${file}: Subdomain must be lowercase`);
        t.is(domain, domain.toLowerCase(), `${file}: Domain must be lowercase`);
    });
});

t("All files should have valid optional owner fields", (t) => {
    const files = fs.readdirSync(domainsPath).filter(file => {
    const filePath = path.join(domainsPath, file);
    return fs.lstatSync(filePath).isFile(); // Only include files
    });
    files.forEach((file) => {
        const data = fs.readJsonSync(path.join(domainsPath, file));

        validateOptionalFields(t, data, optionalOwnerFields, file);
        validateOptionalFields(t, data.owner, optionalOwnerFields, file);

        if (data.owner.email) {
            t.regex(data.owner.email, emailRegex, `${file}: Owner email should be a valid email address`);
        }
    });
});

t("All files should have lowercase subdomain/domain and match filename", (t) => {
    const files = fs.readdirSync(domainsPath).filter(file => {
        const filePath = path.join(domainsPath, file);
        return file.endsWith(".json") && fs.lstatSync(filePath).isFile();
    });

    files.forEach(file => {
        const filePath = path.join(domainsPath, file);
        const data = fs.readJsonSync(filePath);

        const { subdomain, domain } = data;

        t.truthy(subdomain, `${file}: Missing subdomain field`);
        t.truthy(domain, `${file}: Missing domain field`);

        t.is(subdomain, subdomain.toLowerCase(), `${file}: 'subdomain' must be lowercase`);
        t.is(domain, domain.toLowerCase(), `${file}: 'domain' must be lowercase`);

        const expectedFileName = `${subdomain}.${domain}.json`;
        t.is(file, expectedFileName, `${file}: Filename does not match subdomain and domain`);
    });
});

t("All files must use a valid root domain in both file name and JSON content", (t) => {
    const files = fs.readdirSync(domainsPath).filter(file => {
        const filePath = path.join(domainsPath, file);
        return file.endsWith(".json") && fs.lstatSync(filePath).isFile();
    });

    files.forEach(file => {
        const filePath = path.join(domainsPath, file);
        const data = fs.readJsonSync(filePath);

        const domain = data.domain;

        t.truthy(domain, `${file}: Missing domain field`);
        const domainWithDot = `.${domain}`;
        t.true(domains.includes(domainWithDot), `${file}: Domain '${domain}' is not allowed`);

        const endsWithValidDomain = domains.some(valid => file.endsWith(valid + ".json"));
        t.true(endsWithValidDomain, `❌ Filename does not end with a valid root domain: ${file}`);
    });
});

// Thanks is-a.dev for this.
t("JSON files should not be in the root directory", (t) => {
    const rootFiles = fs
        .readdirSync(path.resolve())
        .filter((file) => file.endsWith(".json") && !ignoredRootJSONFiles.includes(file));

    if (rootFiles.length > 0) {
        t.fail(`❌ JSON files should not be in the root directory: ${rootFiles.join(", ")}`);
    } else {
        t.pass();
    }
});

t("All files in the domains directory must have a .json extension", (t) => {
    const files = fs.readdirSync(domainsPath).filter(file => {
        const filePath = path.join(domainsPath, file);
        return fs.lstatSync(filePath).isFile();
    });

    const nonJsonFiles = files.filter(file => !file.endsWith(".json"));

    if (nonJsonFiles.length > 0) {
        t.fail(`❌ Found non-JSON files in domains directory: ${nonJsonFiles.join(", ")}`);
    } else {
        t.pass();
    }
});

// Add test for reserved subdomains
t('Check for reserved subdomains', async t => {
    const files = await fs.readdir(domainsPath);
    
    for (const file of files) {
        if (file.endsWith('.json') && !file.startsWith('_') && !rootDomainFiles.includes(file)) {
            const filePath = path.join(domainsPath, file);
            const content = await fs.readJson(filePath);
            
            if (content.subdomain) {
                // Get the base subdomain (before any dots)
                const baseSubdomain = content.subdomain.split('.')[0];
                
                // Check if the subdomain is in the reserved list
                t.false(
                    reservedSubdomains.includes(baseSubdomain.toLowerCase()),
                    `${file}: Subdomain "${baseSubdomain}" is reserved and cannot be used`
                );
            }
        }
    }
});
