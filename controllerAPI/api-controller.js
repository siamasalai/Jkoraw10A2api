const express = require('express');
const router = express.Router();
const mysql = require('mysql2');

// Import database configuration
const dbConfig = require('../db-details');

// Create MySQL connection pool
const db = mysql.createPool(dbConfig);


// GET method to retrieve all categories
router.get('/categories', (req, res) => {
    const query = 'SELECT CATEGORY_ID, NAME FROM category'; // Updated table name
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching categories:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// GET method to retrieve fundraiser details and donations
router.get('/fundraiser/:id', (req, res) => {
    const fundraiserId = req.params.id;

    const fundraiserQuery = `
        SELECT f.*, c.NAME as CATEGORY_NAME
        FROM fundraiser f
        JOIN category c ON f.CATEGORY_ID = c.CATEGORY_ID
        WHERE f.FUNDRAISER_ID = ?
    `;
    const donationsQuery = `
        SELECT * FROM donation WHERE FUNDRAISER_ID = ?
    `;

    db.query(fundraiserQuery, [fundraiserId], (err, fundraiserResults) => {
        if (err) {
            console.error('Error fetching fundraiser:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (fundraiserResults.length === 0) {
            return res.status(404).json({ error: 'Fundraiser not found' });
        }

        const fundraiser = fundraiserResults[0];

        db.query(donationsQuery, [fundraiserId], (err, donationsResults) => {
            if (err) {
                console.error('Error fetching donations:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            const response = {
                FUNDRAISER_ID: fundraiser.FUNDRAISER_ID,
                ORGANIZER: fundraiser.ORGANIZER,
                CAPTION: fundraiser.CAPTION,
                TARGET_FUNDING: fundraiser.TARGET_FUNDING,
                CURRENT_FUNDING: fundraiser.CURRENT_FUNDING,
                CITY: fundraiser.CITY,
                ACTIVE: fundraiser.ACTIVE,
                CATEGORY_ID: fundraiser.CATEGORY_ID,
                CATEGORY_NAME: fundraiser.CATEGORY_NAME,
                donations: donationsResults.map(donation => ({
                    DONATION_ID: donation.DONATION_ID,
                    NAME: donation.NAME,
                    DATE: donation.DATE,
                    AMOUNT: donation.AMOUNT,
                    GIVER: donation.GIVER
                }))
            };

            res.json(response);
        });
    });
});

// POST method to insert a new donation
router.post('/donation', (req, res) => {
    const insertDonationQuery = `
        INSERT INTO donation (FUNDRAISER_ID, NAME, DATE, AMOUNT, GIVER)
        VALUES (?, ?, ?, ?, ?)
    `;

    const { fundraiserId, name, date, amount, giver } = req.body;

    if (amount <= 0) {
        return res.status(400).json({ error: 'Donation amount must be positive' });
    }

    db.query(insertDonationQuery, [fundraiserId, name, date, amount, giver], (err, result) => {
        if (err) {
            console.error('Error inserting donation:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        // Update CURRENT_FUNDING in the fundraiser table
        const updateFundraiserQuery = `
            UPDATE fundraiser 
            SET CURRENT_FUNDING = CURRENT_FUNDING + ?
            WHERE FUNDRAISER_ID = ? AND CURRENT_FUNDING + ? <= TARGET_FUNDING
        `;

        db.query(updateFundraiserQuery, [amount, fundraiserId, amount], (updateErr, updateResult) => {
            if (updateErr || updateResult.affectedRows === 0) {
                console.error('Error updating fundraiser:', updateErr);
                return res.status(500).json({ error: 'Error updating fundraiser funding' });
            }

            res.status(201).json({ message: 'Donation added successfully', donationId: result.insertId });
        });
    });
});

// POST method to insert a new fundraiser
router.post('/fundraiser', (req, res) => {
    const { organizer, caption, targetFunding, city, active, categoryId } = req.body;

    const insertFundraiserQuery = `
        INSERT INTO fundraiser (ORGANIZER, CAPTION, TARGET_FUNDING, CURRENT_FUNDING, CITY, ACTIVE, CATEGORY_ID)
        VALUES (?, ?, ?, 0, ?, ?, ?)
    `;

    db.query(insertFundraiserQuery, [organizer, caption, targetFunding, city, active, categoryId], (err, result) => {
        if (err) {
            console.error('Error inserting fundraiser:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        res.status(201).json({ message: 'Fundraiser added successfully', fundraiserId: result.insertId });
    });
});

// PUT method to update an existing fundraiser
router.put('/fundraiser/:id', (req, res) => {
    const fundraiserId = req.params.id;
    const { organizer, caption, targetFunding, currentFunding, city, active, categoryId } = req.body;

    const updateFundraiserQuery = `
        UPDATE fundraiser 
        SET ORGANIZER = ?, CAPTION = ?, TARGET_FUNDING = ?, CURRENT_FUNDING = ?, CITY = ?, ACTIVE = ?, CATEGORY_ID = ?
        WHERE FUNDRAISER_ID = ?
    `;

    db.query(updateFundraiserQuery, [organizer, caption, targetFunding, currentFunding, city, active, categoryId, fundraiserId], (err, result) => {
        if (err) {
            console.error('Error updating fundraiser:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Fundraiser not found' });
        }

        res.status(200).json({ message: 'Fundraiser updated successfully' });
    });
});

// DELETE method to delete a fundraiser (only if no donations exist)
router.delete('/fundraiser/:id', (req, res) => {
    const fundraiserId = req.params.id;

    const donationsExistQuery = `
        SELECT COUNT(*) AS donationCount FROM donation WHERE FUNDRAISER_ID = ?
    `;

    db.query(donationsExistQuery, [fundraiserId], (err, results) => {
        if (err) {
            console.error('Error checking donations:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results[0].donationCount > 0) {
            return res.status(400).json({ error: 'Cannot delete fundraiser with donations' });
        }

        const deleteFundraiserQuery = `
            DELETE FROM fundraiser WHERE FUNDRAISER_ID = ?
        `;

        db.query(deleteFundraiserQuery, [fundraiserId], (err, result) => {
            if (err) {
                console.error('Error deleting fundraiser:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Fundraiser not found' });
            }

            res.status(200).json({ message: 'Fundraiser deleted successfully' });
        });
    });
});

module.exports = router;