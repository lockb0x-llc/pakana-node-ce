#!/bin/bash
set -e

if [ ! -f /data/r2.03_x86_64/g/yottadb.dat ]; then
    echo 'Creating fresh r2.03 database...'
    mkdir -p /data/r2.03_x86_64/g /data/r2.03_x86_64/r /data/r2.03_x86_64/o /data/r2.03_x86_64/o/utf8
    
    export ydb_gbldir=/data/r2.03_x86_64/g/yottadb.gld
    export ydb_rel=r2.03_x86_64
    export ydb_dist=/opt/yottadb/current
    
    # Create Global Directory with custom Key and Record sizes
    # Utilizing heredoc for clean GDE input
    $ydb_dist/mumps -run GDE <<EOF
change -region DEFAULT -key_size=256 -record_size=16384
change -segment DEFAULT -file=/data/r2.03_x86_64/g/yottadb.dat
exit
EOF

    $ydb_dist/mupip create
    $ydb_dist/mupip set -journal="enable,on,before" -region DEFAULT
    
    chmod 666 /data/r2.03_x86_64/g/yottadb.gld
    chmod 666 /data/r2.03_x86_64/g/yottadb.dat
    ls -la /data/r2.03_x86_64/g/
else
    echo 'Database already initialized.'
fi

mkdir -p /data/tmp
chmod 777 /data/tmp
