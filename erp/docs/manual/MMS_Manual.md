# Message Management System (MMS) Manual
**Finan Speciality Dental Clinic - ERP**

Version 1.0 | November 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Outbox](#2-outbox)
3. [Templates](#3-templates)
4. [Message Library](#4-message-library)
5. [Composing Messages](#5-composing-messages)
6. [Campaigns](#6-campaigns)
7. [Drafts](#7-drafts)
8. [Reports](#8-reports)

---

## 1. Introduction

The Message Management System (MMS) handles all SMS and messaging communications at Finan Speciality Dental Clinic, including appointment reminders, campaigns, and patient notifications.

---

## 2. Outbox

![Message Outbox](screenshots/mms-01-outbox.png)

The Outbox displays all sent and pending messages:
- Message status (Sent, Pending, Failed)
- Recipient information
- Message content
- Date and time sent
- Delivery status

### 2.1 Outbox After Sending

![Outbox After Send](screenshots/mms-12-outbox-after-send.png)

After sending messages, they appear in the outbox with updated status.

---

## 3. Templates

![Message Templates](screenshots/mms-02-templates.png)

Manage reusable message templates for common communications like appointment reminders, follow-ups, and greetings.

---

## 4. Message Library

![Message Library](screenshots/mms-03-library.png)

The Message Library contains pre-defined message templates categorized by type:
- **REMINDER** - Appointment reminders
- **GREETING** - Birthday and holiday greetings
- **ANNOUNCEMENT** - New services and announcements
- **FOLLOWUP** - Post-visit follow-ups
- **OTHER** - Miscellaneous messages

---

## 5. Composing Messages

### 5.1 Empty Compose Form

![Empty Compose](screenshots/mms-04-compose-empty.png)

To compose a new message:
1. Navigate to Messages → Compose
2. Select recipients
3. Choose a template or write custom message
4. Send or schedule

### 5.2 Search Recipients

![Search Recipients](screenshots/mms-05-compose-search.png)

Search for specific patients to send messages to.

### 5.3 Select Recipients

![Select Recipients](screenshots/mms-06-compose-recipients.png)

Select one or multiple recipients from the patient list.

### 5.4 Choose Template

![Choose Template](screenshots/mms-07-compose-template.png)

Select a message template from the library or templates section.

### 5.5 Filled Compose Form

![Filled Compose](screenshots/mms-08-compose-filled.png)

Review your message with selected recipients and template applied.

### 5.6 Confirm Message

![Confirm Message](screenshots/mms-09-compose-confirm.png)

Confirm the message details before sending.

### 5.7 Send List

![Send List](screenshots/mms-10-compose-send-list.png)

Review the final list of recipients before sending.

### 5.8 Message Sent

![Message Sent](screenshots/mms-11-compose-sent.png)

Confirmation message after successfully sending messages.

---

## 6. Campaigns

![Campaigns](screenshots/mms-13-campaigns.png)

Create and manage bulk messaging campaigns:
- **Create Campaign** - Set up targeted campaigns
- **Audience Filtering** - Filter by language, visit history, SMS consent
- **Scheduling** - Send immediately or schedule for later
- **Tracking** - Monitor campaign performance (Sent, Opened, Skipped)

---

## 7. Drafts

![Drafts](screenshots/mms-14-drafts.png)

Save unfinished messages as drafts and return to them later for editing and sending.

---

## 8. Reports

![Message Reports](screenshots/mms-15-reports.png)

View messaging analytics and reports:
- Message delivery statistics
- Campaign performance metrics
- SMS credit usage
- Success/failure rates

---

**For Support:** Contact the system administrator for assistance with the MMS module.
