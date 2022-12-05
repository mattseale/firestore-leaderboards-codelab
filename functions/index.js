/**
 * Copyright 2022 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
"use strict";

const cors = require("cors")({
  // This is for testing. Don't do it in a real app.
  // See the documentation for more details:
  // https://firebase.google.com/docs/functions/beta/http-events
  origin: true,
});

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

let currentUserID = 0;

// Using a monotonically increasing value for simplicity.
// This makes fetching users to modify their scores later
// easier, which is not a problem you will run into in a
// real game.
/**
 * Generates a new user ID.
 * @return {number} Returns a monotonically increasing integer.
 */
function newUserID() {
  const value = currentUserID;
  currentUserID++;
  return value;
}

// Arbitrarily decided score. Will have a roughly uniform distribution,
// though in real games scores will almost never be evenly distributed.
/**
 * Generates a random score.
 * @return {number} A score between 0 and 1000, including decimals.
 */
function randomScore() {
  return Math.random() * 1000;
}

// Deletes the first 1000 scores, for simplicity. Since collections are
// unbounded, deleting is not trivial. See the docs for more details:
// https://firebase.google.com/docs/firestore/solutions/delete-collections
exports.deleteScores = functions.https.onRequest(async (req, res) => {
  cors(req, res, () => {
    const firestore = admin.firestore();
    const collection = firestore.collection("scores");
    collection.limit(1000).get().then((querySnapshot) => {
      if (querySnapshot.empty) {
        return [];
      }
      const bulkWriter = firestore.bulkWriter();
      const writes = querySnapshot.docs.map((doc) => collection.doc(doc.id))
          .map((ref) => bulkWriter.delete(ref))
          .concat(bulkWriter.close());
      return Promise.all(writes);
    }).then((results) => {
      res.json({
        result: "Executed deletes",
        deletes: results,
      });
    });
  });
});

// Adds 100 random scores.
exports.addScores = functions.https.onRequest(async (req, res) => {
  cors(req, res, () => {
    const collection = admin.firestore().collection("scores");
    const bulkWriter = admin.firestore().bulkWriter();
    const scores = [];
    for (let i = 0; i < 100; i++) {
      scores.push({
        user: newUserID(),
        score: randomScore(),
      });
    }
    Promise.all(
        scores.map((score) => {
          const doc = collection.doc();
          return bulkWriter.create(doc, score);
        }),
        bulkWriter.close(),
    ).then((results) => {
      res.json({
        result: "Added scores",
        writes: results,
      });
    });
  });
});

exports.addScore = functions.https.onRequest(async (req, res) => {
  cors(req, res, () => {

  });
});

exports.updateScore = functions.https.onRequest(async (req, res) => {
  cors(req, res, () => {

  });
});

exports.getRank = functions.https.onRequest(async (req, res) => {
  cors(req, res, () => {

  });
});
