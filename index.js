import { http, storage } from "@ampt/sdk";
import express, { Router } from "express";
import { data } from "@ampt/data";
import Papa from "papaparse";
import multer from 'multer';
const multipartFormLoader = multer({ storage: multer.memoryStorage() }).any();
const app = express();
app.use(multipartFormLoader);

const publicApi = Router();
const csvStorage = storage('csvs');

publicApi.post("/csv", async (req, res) => {
  try {
    const delimiter =  ",";
    if (!req.files || !req.files.length) {
      return res.status(400).send("No files were uploaded.");
    }
    const buffer = req.files[0].buffer;
    const filename = req.files[0].originalname;
    const writeResponse = await csvStorage.write(filename, buffer, {
      metadata: { delimiter },
    });
    return res.json(writeResponse);
  } catch (err) {
    res.status(500).send(err);
  }
});

csvStorage.on("write:*.csv", async (event) => {
  try {
    const { path } = event;
    const { metadata } = await csvStorage.stat(path);
    const delimiter = metadata.delimiter || ",";
    const buffer = await csvStorage.readBuffer(path);
    const csvString = buffer.toString("utf-8");
    const csv = Papa.parse(csvString, {
      header: true,
      delimiter,
    });
    if (csv.data.length) {
      await Promise.all(
        csv.data.map((row) => {
          const id = row["$distinct_id"];
          const firstName = row["$name"];
          const email = row["$email"];
          return data.set(`customer:${id}`, {
            id,
            firstName,
            email,
          });
        })
      );
    }
  } catch (e) {
    console.error(e);
  }
});
app.use("/api", publicApi);
http.useNodeHandler(app);
