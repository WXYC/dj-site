import React from 'react';
import { within, userEvent } from '@storybook/testing-library';
import Dashboard from '../pages/dashboard/DashboardPage';
import FirstSidebar from '../components/dashboard/FirstSidebar';
import SecondSidebar from '../components/dashboard/SecondSidebar';
import { BinProvider } from '../components/dashboard/bin/Bin';

export default {
  title: 'New Interface/Dashboard',
  component: Dashboard,
  parameters: {
    layout: 'fullscreen',
  },
};

export const First_Sidebar = () => {
  return <FirstSidebar />;
};

export const Second_Sidebar = () => {
    return (
        <BinProvider>
            <SecondSidebar />
        </BinProvider>
    )
};
