import React from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import Manage from '../app/manage/page';
import Admin from '../app/admin/page';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(location.pathname.replace(/\/$/,'')==='/admin'?<Admin/>:location.pathname.replace(/\/$/,'')==='/manage'?<Manage/>:<Home/>);
