/*
  Project Pakana: Infrastructure as Code
  Resource: Compute-Optimized CE Node (F-Series)
  Target: pakana.lockb0x.io | Region: westus2
*/

@description('Deployment region. westus2 is required for PremiumV2 availability.')
param location string = 'westus2'

@description('VM Hostname.')
param vmName string = 'pakana-ce-node'

@description('Admin account.')
param adminUsername string = 'pakanaadmin'

@description('Git branch to deploy.')
param branchName string = 'main'

@description('Domain name for the node.')
param domainName string = 'build.lockb0x.dev'

@description('Admin email for SSL.')
param adminEmail string = 'steven@thefirm.codes'

@secure()
@description('SSH Key or Password.')
param adminPasswordOrKey string

@description('Public DNS label. Must be globally unique and alphanumeric.')
param dnsLabel string = 'pakana-ce-${uniqueString(resourceGroup().id)}' 

var networkInterfaceName = '${vmName}-nic'
var nsgName = '${vmName}-nsg'
var publicIpAddressName = '${vmName}-pip'

// 1. Networking: Static IP
resource publicIP 'Microsoft.Network/publicIPAddresses@2023-05-01' = {
  name: publicIpAddressName
  location: location
  zones: ['1']
  sku: { name: 'Standard' }
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: {
      domainNameLabel: dnsLabel
    }
  }
}

// 2. Storage: Premium SSD v2 (Critical for YottaDB Global IO)
resource dataDisk 'Microsoft.Compute/disks@2023-04-02' = {
  name: '${vmName}-data-disk'
  location: location
  zones: ['1']
  sku: { name: 'PremiumV2_LRS' }
  properties: {
    creationData: { createOption: 'Empty' }
    diskSizeGB: 256
    diskIOPSReadWrite: 3000
    diskMBpsReadWrite: 125
  }
}

// 3. Security: Caddy Ingress (80/443)
resource nsg 'Microsoft.Network/networkSecurityGroups@2023-05-01' = {
  name: nsgName
  location: location
  properties: {
    securityRules: [
      {
        name: 'SSH'
        properties: {
          priority: 1000
          access: 'Allow'
          direction: 'Inbound'
          destinationPortRange: '22'
          protocol: 'Tcp'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'HTTP'
        properties: {
          priority: 1010
          access: 'Allow'
          direction: 'Inbound'
          destinationPortRange: '80'
          protocol: 'Tcp'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'HTTPS'
        properties: {
          priority: 1020
          access: 'Allow'
          direction: 'Inbound'
          destinationPortRange: '443'
          protocol: 'Tcp'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
        }
      }
    ]
  }
}

// 4. Compute: F2s_v2 optimized for Rust Validator clock speed
resource vm 'Microsoft.Compute/virtualMachines@2023-07-01' = {
  name: vmName
  location: location
  zones: ['1']
  properties: {
    hardwareProfile: { vmSize: 'Standard_F2s_v2' }
    osProfile: {
      computerName: vmName
      adminUsername: adminUsername
      linuxConfiguration: {
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
      customData: base64(format('''
#cloud-config
runcmd:
  - mkdir -p /data
  - mkfs.ext4 /dev/sdc
  - mount -o noatime /dev/sdc /data
  - echo "/dev/sdc /data ext4 defaults,noatime 0 0" >> /etc/fstab
  - curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
  - usermod -aG docker {0}
  - git clone -b {1} https://github.com/lockb0x-llc/pakana-node-ce /opt/pakana
  - cd /opt/pakana && export DOMAIN_NAME={2} && export ADMIN_EMAIL={3} && bash ./deploy_pakana.sh
''', adminUsername, branchName, domainName, adminEmail))
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: 'ubuntu-24_04-lts'
        sku: 'server'
        version: 'latest'
      }
      osDisk: {
        createOption: 'FromImage'
        diskSizeGB: 64
        managedDisk: { storageAccountType: 'Premium_LRS' }
      }
      dataDisks: [
        {
          lun: 0
          name: '${vmName}-data-disk'
          createOption: 'Attach'
          managedDisk: {
            id: dataDisk.id
          }
        }
      ]
    }
    networkProfile: {
      networkInterfaces: [ { id: nic.id } ]
    }
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2023-05-01' = {
  name: networkInterfaceName
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          publicIPAddress: { id: publicIP.id }
          subnet: { id: resourceId('Microsoft.Network/virtualNetworks/subnets', '${vmName}-vnet', 'default') }
        }
      }
    ]
  }
  dependsOn: [ vnet ]
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: '${vmName}-vnet'
  location: location
  properties: {
    addressSpace: { addressPrefixes: [ '10.0.0.0/16' ] }
    subnets: [
      {
        name: 'default'
        properties: {
          addressPrefix: '10.0.0.0/24'
          networkSecurityGroup: { id: nsg.id }
        }
      }
    ]
  }
}

output fqdn string = publicIP.properties.dnsSettings.fqdn

output publicIP string = publicIP.properties.ipAddress