# Figma Frame Extractor

A simple tool to extract images from Figma files.

## Installation

Install dependencies by running:

```sh
npm install
```

or

```sh
yarn
```

## Configuration

Rename `.env.sample` to `.env`. and include the following information:

- `FIGMA_TOKEN`: your Personal Access Token (create one in your Figma account settings)
- `FIGMA_FILE`: the file ID of the Figma file you want to extract images from
- `PUBLIC_PATH`: the path where the images will be saved.

## Running it

```sh
npm run start
```

or

```sh
yarn start
```

When the script finishes, you will find the extracted images in the folder
defined in the `PUBLIC_PATH` variable. The optimized images will be saved
inside the `PUBLIC_PATH/output` folder.

## Customizing the export

The `Extractor` class expects the following parameters:

- `personalAccessToken`: Figma Personal Access Token
- `fileID`: Figma file ID
- `apiOptions`: Figma API options
- `customOptions`: custom options

### Example

```js
const extractor = new Extractor(
  CONFIG.FIGMA_TOKEN,
  CONFIG.FIGMA_FILE,
  {
    format: "svg",
    pageID: CONFIG.PAGE_ID,
  },
  {
    logger: customLogger,
    types: ["COMPONENT"],
  },
);
```

### API Options

```js
{
  format: 'svg',                // file type (from the Figma API)
  svg_include_id: true,         // incldue id from the Figma API
  pageID: '123:0',              // specify a page
  append_frame_id: true,        // appends the frame id to the filename
  append_page_name: true,       // appends the page name to the filename
  use_pages_as_folders: true,   // create subdirectories with the name of the page
  dont_overwrite: true,         // don't overwrite existing files with the same name
  get_background_color: false,  // get the background color of the page in hexidecimal format
  get_comments: true            // get unresolved comments
}
```

### Custom Options

The `customOptions` object can have the following optional properties:

- **nameFilter**: A custom function to filter components by name
- **logger**: A custom logger function
- **types**: An array of types to extract

The following example demonstrates how to use the `nameFilter` to customize the
export and only extract components that start with the word "block":

```js
    {
      nameFilter: (name) => /^block/.test(name),
      logger: customLogger,
      types: ["COMPONENT"],
    },
```

### SVG Optimization

The script uses [svgo](https://svgo.dev) to optimize SVG files. You can customize the optimization options by editing the corresponding section of the `index.js` file:

```js
const svgo = new SVGO({
  plugins: [
    "cleanupIDs",
    { removeViewBox: false },
    { convertShapeToPath: false },
  ],
});
```
