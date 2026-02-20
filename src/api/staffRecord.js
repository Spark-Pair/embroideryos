// api/staffRecord.js

import axios from "axios";

const BASE = "/api/staff-records";

export const fetchStaffRecords = (params) =>
  axios.get(BASE, { params }).then((r) => r.data);

export const fetchStaffRecordStats = () =>
  axios.get(`${BASE}/stats`).then((r) => r.data);

export const fetchStaffLastRecord = (staff_id) =>
  axios.get(`${BASE}/last/${staff_id}`).then((r) => r.data);

export const fetchStaffRecord = (id) =>
  axios.get(`${BASE}/${id}`).then((r) => r.data);

export const createStaffRecord = (data) =>
  axios.post(BASE, data).then((r) => r.data);

export const updateStaffRecord = (id, data) =>
  axios.put(`${BASE}/${id}`, data).then((r) => r.data);

export const deleteStaffRecord = (id) =>
  axios.delete(`${BASE}/${id}`).then((r) => r.data);

export const toggleStaffRecordStatus = (id) =>
  axios.patch(`/api/staff/${id}/toggle-status`).then((r) => r.data);