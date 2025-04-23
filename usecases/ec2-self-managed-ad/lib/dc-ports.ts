const domain_controller_inbound_ports = [
    {"fromPort": 389, "protocol": ["TCP","UDP"], "description": "LDAP" },
    {"fromPort": 636, "protocol": ["TCP"], "description": "LDAP over SSL" },
    {"fromPort": 3268, "protocol": ["TCP"], "description": "LDAP Global Catalog" },
    {"fromPort": 3269, "protocol": ["TCP"], "description": "LDAP Global Catalog over SSL" },
    {"fromPort": 88, "protocol": ["TCP","UDP"], "description": "Kerberos authentication" },
    {"fromPort": 53,  "protocol": ["TCP","UDP"],"description":"DNS"},
    {"fromPort": 445, "protocol": ["TCP","UDP"], "description": "SMB over TCP/IP" },
    {"fromPort": 25, "protocol": ["TCP"], "description": "Simple Mail Transfer Protocol (SMTP)" },
    {"fromPort": 135, "protocol": ["TCP"], "description": "Remote Procedure Call (RPC) Endpoint Mapper" },
    {"fromPort": 5722, "protocol": ["TCP"], "description": "File Replication" },
    {"fromPort": 123, "protocol": ["UDP"], "description": "Network Time Protocol (NTP)" },
    {"fromPort": 464, "protocol": ["TCP","UDP"], "description": "Kerberos change/set password" },
    {"fromPort": 138, "protocol": ["UDP"], "description": "DFSN, NetLogon, NetBIOS Datagram Service" },
    {"fromPort": 9389, "protocol": ["TCP"], "description": "SOAP" },
    {"fromPort": 67, "protocol": ["UDP"], "description": "DHCP, MADCAP" },
    {"fromPort": 2535, "protocol": ["UDP"], "description": "DHCP, MADCAP" },
    {"fromPort": 137, "protocol": ["UDP"], "description": "NetLogon, NetBIOS Name Resolution" },
    {"fromPort": 139, "protocol": ["UDP"], "description": "DFSN, NetBIOS Session Service, NetLogon" },
    {"fromPort": 49152, "toPort":65535, "protocol": ["UDP"], "description": "Dynamic RPC" },
]
const domain_controller_outbound_ports = [
]