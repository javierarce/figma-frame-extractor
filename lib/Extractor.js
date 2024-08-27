"use strict";

const fs = require("fs");
const https = require("https");
const Figma = require("figma-js");
const getDirName = require("path").dirname;

const DEFAULT_FILE_FORMAT = "svg";

process.on("unhandledRejection", (error) => {
  console.log(error);
});

module.exports = class Extractor {
  constructor(
    personalAccessToken,
    fileID,
    apiOptions = {},
    customOptions = {},
  ) {
    this.fileID = fileID;
    this.pageID = apiOptions.pageID;
    this.apiOptions = {
      format: apiOptions.format || DEFAULT_FILE_FORMAT,
      ...apiOptions,
    };

    this.customOptions = {
      logger: console.log,
      types: null,
      nameFilter: null,
      ...customOptions,
    };

    this.frames = {};

    this.logger = this.customOptions.logger || null;
    this.allowedTypes = this.customOptions.types || null;
    this.nameFilter = this.customOptions.nameFilter || null;

    this.client = Figma.Client({
      personalAccessToken,
    });
  }

  async getDocumentIds({ data }) {
    return new Promise((resolve, _reject) => {
      this.pages = data.document.children;

      if (this.pageID) {
        this.pages = this.pages.filter((page) => page.id === this.pageID);
      }

      let ids = [];

      const processNode = (node) => {
        if (this.filterElement(node)) {
          ids.push(node.id);
          if (this.apiOptions.get_background_color) {
            const backgroundColor = this.rgbToHex(node.backgroundColor);
            this.frames[node.id] = {
              frame: node,
              page: node.parent,
              backgroundColor,
            };
          } else {
            this.frames[node.id] = { frame: node, page: node.parent };
          }
        }

        if (node.children) {
          node.children.forEach(processNode);
        }
      };

      this.pages.forEach((page) => {
        page.children.forEach(processNode);
      });

      if (ids.length) {
        resolve(ids);
      } else {
        resolve([]);
      }
    });
  }

  filterElement(element) {
    return this.filterByType(element) && this.filterByName(element);
  }

  filterByType(element) {
    if (!this.allowedTypes) {
      return true;
    }
    return this.allowedTypes.includes(element.type);
  }

  filterByName(element) {
    if (!this.nameFilter) {
      return true;
    }
    return this.nameFilter(element.name);
  }

  extract(path = ".") {
    this.path = path;

    this.logger(`Starting extraction for file ID: ${this.fileID}`);

    if (this.allowedTypes) {
      this.logger(`Filtering for types: ${this.allowedTypes.join(", ")}`);
    }

    if (this.nameFilter) {
      this.logger(`Applying custom name filter`);
    }

    return this.client
      .file(this.fileID)
      .then(this.getDocumentIds.bind(this))
      .then(this.getFilesByIds.bind(this))
      .then(this.downloadFileImages.bind(this))
      .then(this.getComments.bind(this))
      .catch((e) => {
        this.logger(`Error during extraction: ${e}`, "error");
        throw e;
      });
  }

  getComments(data) {
    return new Promise(async (resolve) => {
      if (!this.apiOptions.get_comments) {
        return resolve(data);
      }

      let pages = this.pages.map((page) => {
        return { id: page.id, frames: page.children.map((c) => c.id) };
      });

      this.client.comments(this.fileID).then((response) => {
        let comments = [];

        response.data.comments.forEach((comment) => {
          let frameId = comment.client_meta
            ? comment.client_meta.node_id
            : undefined;

          let id = undefined;

          pages.forEach((page) => {
            if (page.frames.includes(frameId)) {
              id = page.id;
            }
          });

          if (!comment.resolved_at) {
            if (comments[id]) {
              comments[id].push(comment.message);
            } else {
              comments[id] = [comment.message];
            }
          }
        });

        data.forEach((file) => {
          if (comments[file.page_id]) {
            file.comments = comments[file.page_id];
          }
        });

        resolve(data);
      });
    });
  }

  async getFilesByIds(ids) {
    if (!ids || (Array.isArray(ids) && ids.length === 0)) {
      this.logger("No elements match the specified filters.", "error");
      return { data: { images: {} } };
    }

    let idsArray;
    if (Array.isArray(ids)) {
      idsArray = ids;
    } else if (typeof ids === "string") {
      idsArray = ids.split(",");
    } else if (typeof ids === "object") {
      idsArray = Object.values(ids);
    } else {
      this.logger(`Unexpected ids type: ${typeof ids}`, "error");
      return { data: { images: {} } };
    }

    idsArray = idsArray.filter((id) => id && id.trim() !== "");

    if (idsArray.length === 0) {
      this.logger("No valid IDs to process.", "error");
      return { data: { images: {} } };
    }

    let format = this.apiOptions.format;
    let options = this.apiOptions;

    return this.client.fileImages(this.fileID, {
      format,
      ids: idsArray,
      ...options,
    });
  }

  getImageSavePath(id) {
    let info = this.frames[id];
    let frameID = info.frame.id.replace(":", "_");

    let name = info.frame.name;
    let filename = `${name}.${this.apiOptions.format}`;

    let pageName = this.apiOptions.append_page_name
      ? info.page.name
      : undefined;
    let frameName = this.apiOptions.append_frame_id
      ? info.frame.name
      : undefined;
    let folder = this.apiOptions.use_pages_as_folders
      ? info.page.name
      : undefined;

    name = [pageName, frameName, frameID].filter((n) => n).join("_");

    let path = [this.path, folder, filename].filter((n) => n).join("/");

    if (this.apiOptions.dont_overwrite) {
      let counter = 1;

      while (fs.existsSync(path)) {
        filename = `${name}_(${counter}).${this.apiOptions.format}`;
        path = `${this.path}/${filename}`;
        counter++;
      }
    }

    return { filename, path };
  }

  onGetImage(id, res) {
    return new Promise((resolve, _reject) => {
      let data = "";

      res.setEncoding("binary");

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        this.saveFile(id, data).then((response) => {
          resolve(response);
        });
      });
    });
  }

  saveFile(id, data) {
    return new Promise((resolve, reject) => {
      let savePath = this.getImageSavePath(id);

      fs.mkdir(getDirName(savePath.path), { recursive: true }, (error) => {
        if (error) {
          return reject(error);
        }

        fs.writeFile(savePath.path, data, "binary", (e) => {
          if (e) {
            this.logger(`Error writing file: ${e.message}`, "error");
            return reject(e);
          }

          const frameInfo = this.frames[id] || {};
          const page = frameInfo.page || {};
          const frame = frameInfo.frame || {};

          const result = {
            filename: savePath.filename,
            page_id: page.id || "unknown",
            page: page.name || "unknown",
            type: frame.type || "unknown",
          };

          const backgroundColor = frameInfo.backgroundColor;

          if (backgroundColor) {
            result.background_color = backgroundColor;
          }

          this.logger(`File saved: ${savePath.filename}`, "success");
          resolve(result);
        });
      });
    });
  }

  async downloadFileImages(fileImages) {
    let images = fileImages.data.images;
    let promises = [];

    for (let id in images) {
      let url = images[id];
      if (url) {
        promises.push(await this.downloadImage(id, url));
      }
    }
    return Promise.all(promises);
  }

  async downloadImage(id, url) {
    return new Promise((resolve, reject) => {
      try {
        https.get(url, (res) => {
          this.onGetImage(id, res)
            .then((response) => {
              resolve(response);
            })
            .catch((e) => {
              return reject(e);
            });
        });
      } catch (e) {
        return reject(e);
      }
    });
  }

  rgbToHex(color) {
    return (
      "#" +
      [color.r, color.g, color.b]
        .map((x) => {
          const hex = Math.round(x * 255).toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  }
};
