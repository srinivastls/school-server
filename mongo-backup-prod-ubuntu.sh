#!/bin/bash
FILE=`date +%d-%m-%Y`
DEST=$FILE-prod.gz
echo "$FILE $DEST"
DB_NAME=schooldbProd

# This PARENT_FOLDER is a reference to a Google Drive folder in your account (like, "my-backups"). 
# Use gdrive list to get the ID of the folder you want
PARENT_FOLDER=1UlQm6lGlSDoueCAYEoWEgmPxWqe7MVjo

mongodump -d $DB_NAME --archive=$DEST --gzip

# file ID will be the first word in line 2
prevBackupId=`~/server/school/gdrive --service-account sa.json list --query "'1UlQm6lGlSDoueCAYEoWEgmPxWqe7MVjo' in parents" | awk 'NR == 2 {print $1}'`
echo "backup id $prevBackupId"

#if file id is empty (no file exists), upload file
#else, update file (replace)
if [ "$prevBackupId" == "" ]; then 
    echo "uploading"
    ~/server/school/gdrive --service-account sa.json upload -p $PARENT_FOLDER $DEST
else 
    echo "replacing"
    ~/server/school/gdrive --service-account sa.json update $prevBackupId $DEST
fi

rm $DEST
