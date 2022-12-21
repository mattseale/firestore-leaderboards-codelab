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

const admin = require("firebase-admin");

/**
 * Writes a new score to the leaderboard.
 * @param {string} playerID The ID of the player associated with the score.
 * @param {number} score The score to be written.
 * @param {admin.firestore.Firestore} firestore The database storing
 *     the leaderboard.
 * @return {Promise<admin.firestore.WriteResult | Error>} Returns a promise
 *     that resolves when the write completes.
 */
async function createScore(playerID, score, firestore) {
  const scores = await firestore.collection("scores").get();
  if (scores.empty) {
    // Create the buckets since they don't exist yet.
    // In a real app, don't do this in your write function. Do it once
    // manually and then keep the buckets in your database forever.
    for (let i = 0; i < 10; i++) {
      const min = i * 100;
      const max = (i + 1) * 100;
      const data = {
        range: {
          min: min,
          max: max,
        },
        count: 0,
      };
      await firestore.collection("scores").doc().create(data);
    }
    throw Error("Database not initialized");
  }

  for (const bucket of scores.docs) {
    const range = bucket.get("range");
    if (score >= range.min && score < range.max) {
      const writeBatch = firestore.batch();
      const playerDoc = firestore.collection("players").doc();
      writeBatch.create(playerDoc, {
        user: playerID,
        score: score,
      });
      writeBatch.update(
          bucket.ref,
          {count: admin.firestore.FieldValue.increment(1)},
      );
      const scoreDoc = bucket.ref.collection("scores").doc();
      writeBatch.create(scoreDoc, {
        user: playerID,
        score: score,
      });
      return writeBatch.commit();
    }
  }
}

/**
 * Returns the rank and score of a player in the leaderboard.
 * @param {string} playerID The ID of the player associated with the score.
 * @param {admin.firestore.Firestore} firestore The database storing
 *     the leaderboard.
 * @return {Promise<Object<string, number>>} Returns a promise containing the
 *     player's rank and score.
 */
async function readRank(playerID, firestore) {
  const players = await firestore.collection("players")
      .where("user", "==", playerID).get();
  if (players.empty) {
    throw Error(`Player not found in leaderboard: ${playerID}`);
  }
  if (players.size > 1) {
    console.info(`Multiple scores with player ${playerID}, fetching first`);
  }
  const player = players.docs[0].data();
  const score = player.score;

  const scores = await firestore.collection("scores").get();
  let currentCount = 1; // Player is rank 1 if there's 0 better players.
  let interp = -1;
  for (const bucket of scores.docs) {
    const range = bucket.get("range");
    const count = bucket.get("count");
    if (score < range.min) {
      currentCount += count;
    } else if (score >= range.max) {
      // do nothing
    } else {
      // interpolate where the user is in this bucket based on their score.
      const relativePosition = (score - range.min) / (range.max - range.min);
      interp = Math.round(count - (count * relativePosition));
    }
  }

  if (interp === -1) {
    // Didn't find a correct bucket
    throw Error(`Score out of bounds: ${score}`);
  }

  return {
    user: playerID,
    rank: currentCount + interp,
    score: score,
  };
}

/**
 * Updates the score of a player in the leaderboard.
 * @param {string} playerID The ID of the player associated with the score.
 * @param {number} newScore The player's new score.
 * @param {admin.firestore.Firestore} firestore The database storing
 *     the leaderboard.
 * @return {Promise<admin.firestore.WriteResult | Error>} Returns a promise
 *     that resolves when the write completes.
 */
async function updateScore(playerID, newScore, firestore) {
  const scores = firestore.collection("scores");
  const playerSnapshot = await scores
      .where("user", "==", playerID).get();
  if (playerSnapshot.size === 0) {
    throw Error(`User not found in leaderboard: ${playerID}`);
  }
  const player = playerSnapshot.docs[0];
  const doc = scores.doc(player.id);
  return doc.update({
    user: playerID,
    score: newScore,
  });
}

module.exports = {createScore, readRank, updateScore};
