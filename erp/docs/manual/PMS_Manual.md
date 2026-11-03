# Patient Management System (PMS) Manual
**Finan Speciality Dental Clinic - ERP**

Version 1.0 | November 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Patient List](#2-patient-list)
3. [Adding a New Patient](#3-adding-a-new-patient)
4. [Viewing and Editing Patient Details](#4-viewing-and-editing-patient-details)
5. [Patient Import](#5-patient-import)
6. [Sales Management](#6-sales-management)
7. [Revenue](#7-revenue)
8. [Follow-ups](#8-follow-ups)

---

## 1. Introduction

The Patient Management System (PMS) is the core module for managing patient records, tracking sales, monitoring revenue, and handling follow-up activities at Finan Speciality Dental Clinic.

---

## 2. Patient List

The Patient List provides a complete overview of all registered patients.

![Patient List](screenshots/pms-01-patients-list.png)

**Key Features:**
- View all patients with their details (Name, Age, Phone, Address)
- Quick access to patient actions (View, Edit)
- Search and filter functionality
- "New Patient" button to add patients

### 2.1 Searching Patients

![Patient Search](screenshots/pms-02-patients-search.png)

Use the search bar to find patients by name, phone number, or other details.

### 2.2 Filtering Patients

![Filtered Patients](screenshots/pms-03-patients-filtered.png)

Apply filters to narrow down the patient list based on specific criteria.

---

## 3. Adding a New Patient

### 3.1 Empty Patient Form

![Empty Patient Form](screenshots/pms-04-patient-form-empty.png)

To add a new patient:
1. Click "New Patient" from the patient list
2. Fill in the required information

### 3.2 Filled Patient Form

![Filled Patient Form](screenshots/pms-05-patient-form-filled.png)

**Required Fields:**
- **Full Name (English/Amharic)** - Patient's full name
- **Age** - Patient's age (whole number)
- **Sex** - Male/Female/Other
- **Phone** - Contact number (Ethiopian format accepted)
- **Address** - Patient's address

Click "Save" to create the patient record.

---

## 4. Viewing and Editing Patient Details

### 4.1 Patient Detail View

![Patient Detail](screenshots/pms-06-patient-detail.png)

The patient detail page shows complete patient information, including medical history, appointments, and sales records.

### 4.2 Editing Patient Information

![Edit Patient](screenshots/pms-07-patient-edit.png)

To edit patient information:
1. Click "Edit" from the patient detail page or patient list
2. Update the necessary fields
3. Click "Save" to apply changes

### 4.3 Patient Update Confirmation

![Patient Updated](screenshots/pms-08-patient-updated.png)

A confirmation message appears after successfully updating patient information.

---

## 5. Patient Import

![Patient Import](screenshots/pms-19-patient-import.png)

The patient import feature allows bulk import of patient records from external sources. Follow the provided template format for successful import.

---

## 6. Sales Management

### 6.1 Sales List

![Sales List](screenshots/pms-09-sales-list.png)

View all sales transactions in the Sales module. Track payment status, amounts, and transaction details.

### 6.2 Creating a New Sale

#### Empty Sale Form
![Empty Sale Form](screenshots/pms-10-sale-new-empty.png)

#### Select Patient
![Select Patient](screenshots/pms-11-sale-patient-selected.png)

#### Add Services
![Add Services](screenshots/pms-12-sale-services-added.png)

**Steps to Create a Sale:**
1. Navigate to Sales → New Sale
2. Select or search for the patient
3. Add services from the service catalog
4. Specify quantities if applicable
5. Proceed to payment details

#### Doctor and Payment
![Doctor and Payment](screenshots/pms-13-sale-doctor-and-payment.png)

Assign a doctor (if applicable) and configure payment details:
- Payment method
- Amount paid
- Balance (if any)
- Notes

### 6.3 Sale Receipt

![Sale Receipt](screenshots/pms-14-sale-receipt.png)

Print or view the receipt after completing a sale transaction.

### 6.4 Sales List with Completed Sale

![Sales List with Sale](screenshots/pms-15-sales-list-with-sale.png)

Completed sales appear in the sales list with their status and details.

### 6.5 Sale Detail View

![Sale Detail](screenshots/pms-16-sale-detail.png)

View complete details of any sale transaction, including services, payments, and receipts.

---

## 7. Revenue

![Revenue Report](screenshots/pms-17-revenue.png)

The Revenue module provides financial insights:
- Daily/periodic revenue tracking
- Payment summaries
- Revenue by service/doctor
- Outstanding balances

---

## 8. Follow-ups

![Follow-ups](screenshots/pms-18-follow-ups.png)

Track patient follow-ups and scheduled callbacks to ensure continuity of care and patient satisfaction.

---

**For Support:** Contact the system administrator for assistance with the PMS module.
