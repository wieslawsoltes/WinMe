import { createBrowser, createInternetOptions } from './browser.js';
import { createOutlook, createAddressBook } from './mail.js';
import { createNetwork, createNetworkWizard, createMessenger } from './network.js';
export function registerInternet(registry) {
  for (const app of [
    {
      id: 'browser',
      title: 'Internet Explorer',
      icon: 'ie',
      commands: ['iexplore', 'iexplore.exe'],
      extensions: ['htm', 'html', 'url'],
      create: createBrowser,
    },
    {
      id: 'outlook',
      singleton: true,
      title: 'Outlook Express',
      icon: 'mail',
      commands: ['msimn', 'msimn.exe'],
      create: createOutlook,
    },
    {
      id: 'addressbook',
      title: 'Address Book',
      icon: 'mail',
      commands: ['wab', 'wab.exe'],
      create: createAddressBook,
    },
    {
      id: 'network',
      title: 'My Network Places',
      icon: 'network',
      commands: ['netcpl', 'netcpl.cpl'],
      create: createNetwork,
    },
    {
      id: 'network-wizard',
      title: 'Home Networking Wizard',
      icon: 'network',
      commands: ['netsetup', 'icwconn1', 'inetwiz'],
      create: createNetworkWizard,
    },
    {
      id: 'internet-options',
      title: 'Internet Properties',
      icon: 'ie',
      commands: ['inetcpl.cpl'],
      create: createInternetOptions,
    },
    {
      id: 'messenger',
      title: 'MSN Messenger Service',
      icon: 'mail',
      commands: ['msmsgs'],
      create: createMessenger,
    },
  ])
    registry.register({ ...app, category: 'Internet' });
}
