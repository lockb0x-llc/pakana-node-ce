@description('Username for the Virtual Machine.')
param adminUsername string

@description('SSH Key or password for the Virtual Machine. SSH key is recommended.')
@secure()
param adminPasswordOrKey string

@description('The domain name for the node (e.g., node.example.com)')
param domainName string

@description('The email address for Let\'s Encrypt notifications')
param adminEmail string

@description('Unique DNS Name for the Public IP used to access the Virtual Machine.')
param dnsLabelPrefix string = toLower('${domainName}-${uniqueString(resourceGroup().id)}')

@description('The Ubuntu version for the VM. This will pick the latest 24.04 LTS version.')
param ubuntuOSVersion string = '24_04-lts'

@description('Location for all resources.')
param location string = resourceGroup().location

@description('The size of the VM')
param vmSize string = 'Standard_F2s_v2'

@description('Name of the virtual machine')
param vmName string = 'pakana-node-vm'

@description('Security Type of the Virtual Machine.')
@allowed([
  'Standard'
  'TrustedLaunch'
])
param securityType string = 'TrustedLaunch'

var publicIpName = '${vmName}-pip'
var networkSecurityGroupName = '${vmName}-nsg'
var vnetName = '${vmName}-vnet'
var subnetName = 'default'
var networkInterfaceName = '${vmName}-nic'
var osDiskType = 'Premium_LRS'
var subnetAddressPrefix = '10.1.0.0/24'
var addressPrefix = '10.1.0.0/16'
var linuxConfiguration = {
  disablePasswordAuthentication: true
  ssh: {
    publicKeys: [
      {
        path: '/home/${adminUsername}/.ssh/authorized_keys'
        keyData: adminPasswordOrKey
      }
    ]
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2021-05-01' = {
  name: networkInterfaceName
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          subnet: {
            id: subnet.id
          }
          privateIPAllocationMethod: 'Dynamic'
          publicIPAddress: {
            id: publicIp.id
          }
        }
      }
    ]
    networkSecurityGroup: {
      id: nsg.id
    }
  }
}

resource nsg 'Microsoft.Network/networkSecurityGroups@2021-05-01' = {
  name: networkSecurityGroupName
  location: location
  properties: {
    securityRules: [
      {
        name: 'SSH'
        properties: {
          priority: 1000
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '22'
        }
      }
      {
        name: 'HTTP'
        properties: {
          priority: 1010
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '80'
        }
      }
      {
        name: 'HTTPS'
        properties: {
          priority: 1020
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2021-05-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        addressPrefix
      ]
    }
    subnets: [
      {
        name: subnetName
        properties: {
          addressPrefix: subnetAddressPrefix
        }
      }
    ]
  }
}

resource subnet 'Microsoft.Network/virtualNetworks/subnets@2021-05-01' existing = {
  parent: vnet
  name: subnetName
}

resource publicIp 'Microsoft.Network/publicIPAddresses@2021-05-01' = {
  name: publicIpName
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: {
      domainNameLabel: dnsLabelPrefix
    }
  }
}

resource vm 'Microsoft.Compute/virtualMachines@2022-03-01' = {
  name: vmName
  location: location
  properties: {
    hardwareProfile: {
      vmSize: vmSize
    }
    osProfile: {
      computerName: vmName
      adminUsername: adminUsername
      customData: base64(format('#cloud-config\npackage_upgrade: true\npackages:\n  - docker.io\n  - docker-compose\nwrite_files:\n  - path: /etc/environment\n    content: |\n      DOMAIN_NAME={0}\n      ADMIN_EMAIL={1}\n    append: true\nruncmd:\n  - usermod -aG docker {2}\n  - echo "kernel.sem=250 32000 100 128" >> /etc/sysctl.conf\n  - sysctl -p\n', domainName, adminEmail, adminUsername))
      linuxConfiguration: linuxConfiguration
    }
    storageProfile: {
      osDisk: {
        createOption: 'FromImage'
        managedDisk: {
          storageAccountType: osDiskType
        }
      }
      imageReference: {
        publisher: 'Canonical'
        offer: '0001-com-ubuntu-server-jammy'
        sku: ubuntuOSVersion
        version: 'latest'
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: nic.id
        }
      ]
    }
    diagnosticsProfile: {
      bootDiagnostics: {
        enabled: true
      }
    }
    securityProfile: {
      securityType: securityType
      uefiSettings: {
        secureBootEnabled: true
        vTpmEnabled: true
      }
    }
  }
}

output hostname string = publicIp.properties.dnsSettings.fqdn
output sshCommand string = 'ssh ${adminUsername}@${publicIp.properties.dnsSettings.fqdn}'
output publicIP string = publicIp.properties.ipAddress
