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

- `FIGMA_TOKEN`: a Personal Access Token, which can be created in the Figma account settings.
- `FIGMA_FILE`: the file ID of the Figma file you want to extract images from.
- `PUBLIC_PATH`: the path where the images will be saved.

## Running it

```sh
yarn start
```

## Customizing the export

The `Extractor` class expects the following parameters:

````js
personalAccessToken // Figma personal access token
fileID // Figma file ID
apiOptions = {} // Figma API options
customOptions = {} // Custom options
```

### Example

```js
const extractor = new Extractor(
  CONFIG.FIGMA_TOKEN,
  CONFIG.FIGMA_FILE,
  {
    format: "svg",
    pageID: CONFIG.PAGE_ID,
  }, {
    logger: customLogger,
    types: ["COMPONENT"],
  },
);
````

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

- **nameFilter**: A custom function that lets you filter the components by name.
- **logger**: A custom logger function.
- **types**: An array of types to extract.

The following example shows how to use the `nameFilter` and `logger` options to customize the export and
only extract components that start with the word "block".

```js
    {
      nameFilter: (name) => /^block/.test(name),
      logger: customLogger,
      types: ["COMPONENT"],
    },
```
