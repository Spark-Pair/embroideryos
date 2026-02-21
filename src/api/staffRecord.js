import { apiClient } from './apiClient';

const STAFF_RECORDS_URL = "/staff-records";

export const fetchStaffRecords = (params) =>
  apiClient.get(STAFF_RECORDS_URL, { params }).then((r) => r.data);

export const fetchStaffRecordStats = () =>
  apiClient.get(`${STAFF_RECORDS_URL}/stats`).then((r) => r.data);

export const fetchStaffLastRecord = (staff_id) =>
  apiClient.get(`${STAFF_RECORDS_URL}/last/${staff_id}`).then((r) => r.data);

export const fetchStaffRecord = (id) =>
  apiClient.get(`${STAFF_RECORDS_URL}/${id}`).then((r) => r.data);

export const createStaffRecord = (data) =>
  apiClient.post(STAFF_RECORDS_URL, data).then((r) => r.data);

export const updateStaffRecord = (id, data) =>
  apiClient.put(`${STAFF_RECORDS_URL}/${id}`, data).then((r) => r.data);

export const deleteStaffRecord = (id) =>
  apiClient.delete(`${STAFF_RECORDS_URL}/${id}`).then((r) => r.data);

export const toggleStaffRecordStatus = (id) =>
  apiClient.patch(`${STAFF_RECORDS_URL}/${id}/toggle-status`).then((r) => r.data);