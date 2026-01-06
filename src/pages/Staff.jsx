// src/pages/Staff.jsx
import React, { useState } from 'react';
import Button from '../components/button';

export default function Staff() {
  const [staffList, setStaffList] = useState([
    { id: 1, name: 'Hasan', joiningDate: '2025-01-01', salary: 30000, status: 'Active' },
    { id: 2, name: 'Ali', joiningDate: '2025-02-15', salary: 25000, status: 'Inactive' },
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Staff Management</h1>
      <Button className="mb-4">Add Staff</Button>

      <table className="w-full border">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Joining Date</th>
            <th>Salary</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {staffList.map(staff => (
            <tr key={staff.id}>
              <td>{staff.id}</td>
              <td>{staff.name}</td>
              <td>{staff.joiningDate}</td>
              <td>{staff.salary}</td>
              <td>{staff.status}</td>
              <td>
                <Button>Edit</Button> <Button>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
