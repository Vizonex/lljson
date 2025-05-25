# LLJSON
A Parser inspired by __llhttp__ for handling speedy reading and parsing of json datatypes
this parser borrows the same functionallity as __llhttp__ so that callbacks can be used
to filter and walk through very specific data rather than loads of unwanted data.

## Built around the idea that

- Developers tend to filter loads of json responses for just one object or array.

- Loading Large sums of data into memory is a waste of time. When we get into gigabyte or terribyte territories
this can become a serious problem with average tools.

- Data Conversions should be done immediatley and by yourself and not loaded into memory first thing.

- You can scrape unlimited supplies of Json 
    - without loosing memory
    - requiring too much memory

- You can set a recursion limit to control how many containers the parser remebers.
    - The Parser only requires one Malloc Call and can be easily done with others 
    like Python's CAPI (PyMem_Malloc) or mimalloc for instance...

- You can skip or ignore datatypes you do not wish to use...

- You can pause the parser on any callback allowing languages like Python to create Yeild Generators 
for certain types of data being returned.

- This library should be compatiable with llhttp meaning there should be no compiling 
errors between these libraries if they are being intermixed.

- RFC 8259 should be strictly obyed. 

- You can build off of lljson to create a more advanced library for other languages or other algorythms in general.

- Modern Json Libraries can be slow because they have to allocate unwanted 
memory before you can move through all of it.


Currently I am finishing up the first version and need to add some native C Api stuff.
You can compile the current C Code using typescript which I programmed with in the hopes
that contribution will come around at somepoint.



