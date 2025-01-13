"use client";
import { useAppSelector } from '@/lib/hooks';
import { getClassic } from '@/lib/slices/application/selectors';
import React from 'react';
import { ClassicDJRosterPage } from './classic';
import { ModernDJRosterPage } from './modern';

const AdminRosterPage = (): JSX.Element => {
  const classic = useAppSelector(getClassic);

  return classic ? <ClassicDJRosterPage /> : <ModernDJRosterPage />;
};

export default AdminRosterPage;