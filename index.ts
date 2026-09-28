"use strict";

import { AssetResponseDto, init } from "@immich/sdk";
import express from "express";
import { onAssetCreated } from "./handlers/asset-created.js";

if (process.env.LOG_LEVEL === 'info') {
    console.debug = function() {};
}

init({
    baseUrl: "http://immich_server:2283/api",
    apiKey: "NONCE: expect each API call to provide an API key explicitly"
});

const app = express();
const port = "80";

app.use(express.json());

app.post("/", async (req, res) => {
    console.debug("Received request");

    try {
        const trigger = req.body.trigger;
        if (trigger === "AssetCreate") {
            const asset = req.body.data.asset as AssetResponseDto;
            await onAssetCreated(asset);

            res.sendStatus(204);
        } else {
            res.status(400).send(`Unexpected trigger: ${trigger}`);
        }
    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).send("Internal Server Error");
    }

    console.log("Response sent");
});

app.listen(port, () => {
    console.log(`Immich workflows companion server is listening on port ${port}`);
});
