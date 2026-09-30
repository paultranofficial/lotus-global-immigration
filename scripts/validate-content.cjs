#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');

const ROOT = path.resolve(__dirname, '..');
const contentPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'content.json');
const schemaPath = path.join(ROOT, 'content.schema.json');

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    err.message = `${file}: ${err.message}`;
    throw err;
  }
}

function formatError(error) {
  const place = error.instancePath || '(root)';
  if (error.keyword === 'required') {
    return `${place}: missing required property "${error.params.missingProperty}"`;
  }
  if (error.keyword === 'additionalProperties') {
    return `${place}: unknown property "${error.params.additionalProperty}"`;
  }
  return `${place}: ${error.message}`;
}

const schema = loadJson(schemaPath);
const content = loadJson(contentPath);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

if (!validate(content)) {
  console.error(`Content validation failed for ${path.relative(ROOT, contentPath) || contentPath}:`);
  validate.errors.forEach((error) => console.error(`- ${formatError(error)}`));
  process.exit(1);
}

console.log(`✓ ${path.relative(ROOT, contentPath) || contentPath} matches content.schema.json`);
