"use strict";

require("dotenv").config();
const fs = require("fs").promises;
const path = require("path");
const Extractor = require("./lib/Extractor");
const SVGO = require("svgo");
const ora = require("ora");
const spinner = ora("Extracting…").start();

// Configuration
const CONFIG = {
  FIGMA_TOKEN: process.env.FIGMA_TOKEN,
  FIGMA_FILE: process.env.FIGMA_FILE,
  PUBLIC_PATH: process.env.PUBLIC_PATH,
  PAGE_ID: "8:13",
};

// SVGO configuration
const svgo = new SVGO({
  plugins: [
    "cleanupIDs",
    { removeViewBox: false },
    { convertShapeToPath: false },
  ],
});

// Custom logger
const customLogger = (message, type = "info") => {
  switch (type) {
    case "info":
      spinner.info(message);
      spinner.start();
      break;
    case "success":
      spinner.succeed(message);
      break;
    case "warning":
      spinner.warn(message);
      break;
    case "error":
      spinner.fail(message);
      break;
    default:
      spinner.text = message;
  }
};

// Validate environment variables
function validateConfig() {
  const { FIGMA_TOKEN, FIGMA_FILE, PUBLIC_PATH } = CONFIG;
  if (!FIGMA_TOKEN || !FIGMA_FILE || !PUBLIC_PATH) {
    console.error("Please provide FIGMA_TOKEN, FIGMA_FILE and PUBLIC_PATH");
    process.exit(1);
  }
}

// Optimize SVG files
async function optimizeSVGFiles(files) {
  customLogger("Optimizing SVG files");

  let optimizedCount = 0;
  const outputDir = path.join(CONFIG.PUBLIC_PATH, "output");

  try {
    await fs.mkdir(outputDir, { recursive: true });
    customLogger(`Output directory created: ${outputDir}`, "info");
  } catch (error) {
    customLogger(`Error creating output directory: ${error.message}`, "error");
    return;
  }

  for (const file of files) {
    if (file.filename && file.filename.endsWith(".svg") === false) {
      continue;
    }

    const inputPath = path.join(CONFIG.PUBLIC_PATH, file.filename);
    const outputPath = path.join(outputDir, file.filename);

    try {
      const data = await fs.readFile(inputPath, "utf8");
      const result = await svgo.optimize(data, { path: inputPath });
      await fs.writeFile(outputPath, result.data);
      optimizedCount++;
      customLogger(
        `Optimized: ${file.filename} (${optimizedCount}/${files.length})`,
        "success",
      );
    } catch (error) {
      customLogger(
        `Error optimizing file ${file.filename}: ${error.message}`,
        "error",
      );
    }
  }

  customLogger(
    `Successfully optimized ${optimizedCount} out of ${files.length} SVG files`,
    "success",
  );
}

// Extract and process SVG files
async function extractAndProcessSVGs() {
  spinner.info("Extracting SVG files from Figma").start();

  const extractor = new Extractor(
    CONFIG.FIGMA_TOKEN,
    CONFIG.FIGMA_FILE,
    {
      format: "svg",
      pageID: CONFIG.PAGE_ID,
      svg_include_id: true,
      append_frame_id: true,
    },
    {
      logger: customLogger,
      types: ["COMPONENT"],
    },
  );

  try {
    const files = await extractor.extract(CONFIG.PUBLIC_PATH);
    await optimizeSVGFiles(files);
    spinner.succeed(`Successfully extracted ${files.length} SVG files`);
  } catch (error) {
    spinner.fail(`Error during extraction: ${error.message}`);
  }
}

// Main function
async function main() {
  validateConfig();
  await extractAndProcessSVGs();
}

// Run the script
main().catch((error) => {
  console.error("An unexpected error occurred:", error);
  process.exit(1);
});
