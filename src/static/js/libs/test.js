db.post.aggregate(    
    {$unwind : "$tags"},
    {$group: {_id : "$tags.tag","posts" : {$addToSet : {postid : "$_id", content : "$content",
        rank : "$rank"
        }},
    "thot" : {$max : "$rank"}}},
    {$unwind : "$posts"},
    {$project:{ _id : "$posts.postid", rank : "$posts.rank",content : "$posts.content", tag : "$_id", 
        ehot : {$divide : ["$posts.rank","$thot"]}}},
     {$sort : {"ehot" : -1,"_id" : 1}}
      //  {$group : {_id : "$_id"}},
        //    {$project:{content : 1}}

    )